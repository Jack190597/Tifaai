import { useState, useEffect, useRef } from "react";

const COMMANDS = [
  {
    trigger: /accendi luci/i,
    action: () => "Sto accendendo le luci (simulazione).",
  },
  {
    trigger: /che ore sono/i,
    action: () => `Sono le ${new Date().toLocaleTimeString("it-IT")}.`,
  },
  {
    trigger: /spegnere luci/i,
    action: () => "Luci spente (simulazione).",
  },
  // Aggiungi altri comandi qui
];

export default function App() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [conversation, setConversation] = useState([
    {
      role: "system",
      content:
        "Sei Tifa, un assistente vocale AI in italiano, rispondi in modo naturale e sintetico.",
    },
  ]);
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState("Dì 'Tifa' per attivare l'ascolto.");
  const recognitionRef = useRef(null);
  const wakeWordDetectedRef = useRef(false);

  useEffect(() => {
    if (!("webkitSpeechRecognition" in window)) {
      alert(
        "Browser non supporta riconoscimento vocale. Usa Chrome o Edge."
      );
      return;
    }
    const recognition = new webkitSpeechRecognition();
    recognition.lang = "it-IT";
    recognition.continuous = true; // continuo per ascolto wake word
    recognition.interimResults = true;

    recognition.onresult = (e) => {
      let interimTranscript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const text = e.results[i][0].transcript.trim();
          if (!wakeWordDetectedRef.current) {
            if (text.toLowerCase().includes("tifa")) {
              wakeWordDetectedRef.current = true;
              setStatus("Wake word riconosciuta. Parla ora.");
              startListeningSession();
            }
          } else {
            setTranscript(text);
            recognition.stop(); // fermiamo l’ascolto continuo per processare
            processUserMessage(text);
          }
        } else {
          interimTranscript += e.results[i][0].transcript;
          setStatus(`Ascolto... ${interimTranscript}`);
        }
      }
    };

    recognition.onerror = (e) => {
      setStatus("Errore riconoscimento vocale: " + e.error);
      setListening(false);
      wakeWordDetectedRef.current = false;
      recognition.stop();
    };

    recognition.onend = () => {
      setListening(false);
      wakeWordDetectedRef.current = false;
      setStatus("Dì 'Tifa' per attivare l'ascolto.");
    };

    recognitionRef.current = recognition;
    recognition.start();

    return () => {
      recognition.stop();
    };
  }, []);

  function startListeningSession() {
    setListening(true);
    setStatus("Sto ascoltando...");
  }

  async function processUserMessage(text) {
    setStatus("Sto pensando...");
    setResponse("");

    // Controllo comandi personalizzati
    for (const cmd of COMMANDS) {
      if (cmd.trigger.test(text)) {
        const cmdResponse = cmd.action();
        setResponse(cmdResponse);
        setStatus("Risposta pronta.");
        speak(cmdResponse);
        resetWakeWord();
        return;
      }
    }

    // Se nessun comando, procedi con AI
    const updatedConv = [...conversation, { role: "user", content: text }];
    setConversation(updatedConv);

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: updatedConv,
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      if (!res.ok) throw new Error(`Errore API: ${res.status}`);

      const data = await res.json();
      const reply = data.choices[0].message.content;

      const convWithReply = [...updatedConv, { role: "assistant", content: reply }];
      setConversation(convWithReply);
      setResponse(reply);
      setStatus("Risposta pronta.");
      speak(reply);
    } catch (err) {
      setStatus("Errore comunicazione modello: " + err.message);
    } finally {
      resetWakeWord();
    }
  }

  function resetWakeWord() {
    wakeWordDetectedRef.current = false;
    setListening(false);
    setTranscript("");
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) {
      setStatus("Sintesi vocale non supportata.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "it-IT";
    speechSynthesis.speak(utterance);
  }

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "Arial, sans-serif",
        maxWidth: 600,
        margin: "auto",
      }}
    >
      <h1 style={{ textAlign: "center" }}>TIFA - Assistente Vocale AI</h1>

      <p
        style={{
          textAlign: "center",
          fontStyle: "italic",
          color: "#666",
          marginTop: 10,
          marginBottom: 20,
        }}
      >
        {status}
      </p>

      {transcript && (
        <div
          style={{
            backgroundColor: "#eee",
            padding: 15,
            borderRadius: 10,
            marginBottom: 10,
          }}
        >
          <strong>Hai detto:</strong>
          <p>{transcript}</p>
        </div>
      )}

      {response && (
        <div
          style={{
            backgroundColor: "#6a0dad",
            color: "white",
            padding: 15,
            borderRadius: 10,
            minHeight: 60,
          }}
        >
          <strong>Risposta di Tifa:</strong>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}
