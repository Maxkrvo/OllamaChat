"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { stripMarkdownForSpeech, PAUSE_MS, type PauseType } from "@/lib/sentence-splitter";

interface UseVoiceOptions {
  onTranscription: (text: string) => void;
}

export function useVoice({ onTranscription }: UseVoiceOptions) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceAutoSpeak, setVoiceAutoSpeak] = useState(false);
  const [voiceHealthy, setVoiceHealthy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioQueueRef = useRef<{ blob: Blob; pause: PauseType }[]>([]);
  const playingQueueRef = useRef(false);
  const ttsAbortRef = useRef<AbortController[]>([]);
  const pendingTtsAudioRef = useRef<Map<number, { blob: Blob; pause: PauseType }>>(new Map());
  const failedTtsSeqRef = useRef<Set<number>>(new Set());
  const nextTtsSeqRef = useRef(0);
  const expectedTtsSeqRef = useRef(0);
  const ttsGenerationRef = useRef(0);

  // Load voice config
  const loadConfig = useCallback(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg: { voiceEnabled?: boolean; voiceAutoSpeak?: boolean }) => {
        setVoiceEnabled(!!cfg.voiceEnabled);
        setVoiceAutoSpeak(!!cfg.voiceAutoSpeak);
      })
      .catch(() => {
        setVoiceEnabled(false);
        setVoiceAutoSpeak(false);
      });
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Health check when voice is enabled
  useEffect(() => {
    if (!voiceEnabled) {
      setVoiceHealthy(false);
      return;
    }

    fetch("/api/voice/health")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setVoiceHealthy(!!data?.healthy))
      .catch(() => setVoiceHealthy(false));
  }, [voiceEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioRef.current?.pause();
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    ttsGenerationRef.current++;
    for (const ctrl of ttsAbortRef.current) {
      ctrl.abort();
    }
    ttsAbortRef.current = [];
    audioQueueRef.current = [];
    pendingTtsAudioRef.current.clear();
    failedTtsSeqRef.current.clear();
    nextTtsSeqRef.current = 0;
    expectedTtsSeqRef.current = 0;
    playingQueueRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setSpeaking(false);
  }, []);

  function drainPendingTtsInOrder() {
    while (true) {
      const expectedSeq = expectedTtsSeqRef.current;

      if (failedTtsSeqRef.current.has(expectedSeq)) {
        failedTtsSeqRef.current.delete(expectedSeq);
        expectedTtsSeqRef.current = expectedSeq + 1;
        continue;
      }

      const ready = pendingTtsAudioRef.current.get(expectedSeq);
      if (!ready) break;

      pendingTtsAudioRef.current.delete(expectedSeq);
      audioQueueRef.current.push(ready);
      expectedTtsSeqRef.current = expectedSeq + 1;
    }
  }

  const playNextInQueue = useCallback(() => {
    if (playingQueueRef.current) return;
    const entry = audioQueueRef.current.shift();
    if (!entry) {
      if (ttsAbortRef.current.length === 0) {
        setSpeaking(false);
      }
      return;
    }

    playingQueueRef.current = true;
    setSpeaking(true);
    const url = URL.createObjectURL(entry.blob);
    const audio = new Audio(url);
    audioRef.current = audio;

    const pauseMs = PAUSE_MS[entry.pause];
    audio.onended = () => {
      URL.revokeObjectURL(url);
      playingQueueRef.current = false;
      setTimeout(playNextInQueue, pauseMs);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      playingQueueRef.current = false;
      playNextInQueue();
    };
    audio.play().catch(() => {
      playingQueueRef.current = false;
      playNextInQueue();
    });
  }, []);

  const enqueueSentenceTTS = useCallback(
    (sentence: string, pause: PauseType = "medium") => {
      const cleanText = stripMarkdownForSpeech(sentence);
      if (!cleanText) return;

      const seq = nextTtsSeqRef.current++;
      const generation = ttsGenerationRef.current;
      const ctrl = new AbortController();
      ttsAbortRef.current.push(ctrl);

      const removeCtrl = () => {
        ttsAbortRef.current = ttsAbortRef.current.filter((c) => c !== ctrl);
      };

      fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText }),
        signal: ctrl.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error("Speech request failed");
          return res.blob();
        })
        .then((blob) => {
          removeCtrl();
          if (generation !== ttsGenerationRef.current) return;
          pendingTtsAudioRef.current.set(seq, { blob, pause });
          drainPendingTtsInOrder();
          playNextInQueue();
        })
        .catch((err) => {
          removeCtrl();
          if (generation !== ttsGenerationRef.current) return;
          if (err instanceof DOMException && err.name === "AbortError") return;
          failedTtsSeqRef.current.add(seq);
          drainPendingTtsInOrder();
          playNextInQueue();
          console.error("Voice chunk error:", err);
        });
    },
    [playNextInQueue]
  );

  const speakText = useCallback(
    async (text: string) => {
      if (!voiceEnabled || !voiceHealthy) return;
      const cleanText = stripMarkdownForSpeech(text);
      if (!cleanText) return;

      try {
        setSpeaking(true);
        const res = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanText }),
        });
        if (!res.ok) throw new Error("Speech request failed");

        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setSpeaking(false);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          setSpeaking(false);
        };
        await audio.play();
      } catch (err) {
        console.error("Voice playback error:", err);
        setSpeaking(false);
      }
    },
    [voiceEnabled, voiceHealthy]
  );

  const startRecording = useCallback(async () => {
    if (!voiceEnabled || !voiceHealthy || recording || transcribing) return;

    try {
      stopSpeaking();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      micStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        micStreamRef.current?.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) {
          setTranscribing(false);
          return;
        }

        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");
          const res = await fetch("/api/voice/transcribe", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) throw new Error("Transcription failed");
          const data = await res.json();
          if (typeof data.text === "string" && data.text.trim()) {
            onTranscription(data.text.trim());
          }
        } catch (err) {
          console.error("Voice transcription error:", err);
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
      setRecording(false);
    }
  }, [voiceEnabled, voiceHealthy, recording, transcribing, stopSpeaking, onTranscription]);

  const stopRecording = useCallback(() => {
    if (!recording) return;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setRecording(false);
  }, [recording]);

  const toggleAutoSpeak = useCallback(async () => {
    const next = !voiceAutoSpeak;
    setVoiceAutoSpeak(next);
    await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceAutoSpeak: next }),
    }).catch(() => {
      setVoiceAutoSpeak(!next);
    });
  }, [voiceAutoSpeak]);

  return {
    voiceEnabled,
    voiceAutoSpeak,
    voiceHealthy,
    recording,
    transcribing,
    speaking,
    startRecording,
    stopRecording,
    speakText,
    stopSpeaking,
    enqueueSentenceTTS,
    toggleAutoSpeak,
    streamingTTSEnabled: voiceAutoSpeak && voiceEnabled && voiceHealthy,
  };
}
