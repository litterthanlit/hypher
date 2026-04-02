"use client";

import { useState, useEffect } from "react";

export interface ToastMessage {
  id: string;
  text: string;
  action?: { label: string; onClick: () => void };
}

interface Props {
  messages: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ messages, onDismiss }: Props) {
  return (
    <div className="toast-container">
      {messages.map((msg) => (
        <ToastItem key={msg.id} message={msg} onDismiss={() => onDismiss(msg.id)} />
      ))}
    </div>
  );
}

function ToastItem({ message, onDismiss }: { message: ToastMessage; onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 200);
    }, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className={`toast ${exiting ? "toast-exit" : ""}`}>
      <span className="toast-text">{message.text}</span>
      {message.action && (
        <button className="toast-action" onClick={message.action.onClick}>
          {message.action.label}
        </button>
      )}
      <button className="toast-close" onClick={() => { setExiting(true); setTimeout(onDismiss, 200); }}>
        ×
      </button>
    </div>
  );
}
