import { useEffect, useRef, useState } from "react";
import { getApiKey, looksLikeAnthropicKey, setApiKey } from "../apiKey.ts";

interface ApiKeyDialogProps {
  /** Whether the deployment has a server-side fallback key configured. */
  hasServerKey: boolean;
  onClose: () => void;
  onSaved: (hasKey: boolean) => void;
}

/** Modal for entering/clearing the user's own Anthropic API key (BYOK). */
export function ApiKeyDialog({ hasServerKey, onClose, onSaved }: ApiKeyDialogProps) {
  const [value, setValue] = useState(getApiKey());
  const [warn, setWarn] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const save = () => {
    const key = value.trim();
    if (key && !looksLikeAnthropicKey(key)) {
      setWarn(
        "That doesn't look like an Anthropic API key (they start with sk-ant-). Saved anyway — double-check if requests fail.",
      );
    }
    setApiKey(key);
    onSaved(Boolean(key));
    if (!key || looksLikeAnthropicKey(key)) onClose();
  };

  return (
    <div className="mc-modal-backdrop" onMouseDown={onClose}>
      <div className="mc-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mc-popover-head">
          🔑 Your Anthropic API key
          <button className="mc-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="mc-modal-text">
          The key is stored <strong>only in your browser</strong> (localStorage) and
          sent along with each AI request. The server uses it for that single call
          and never stores it.
          {hasServerKey && (
            <> This deployment also has a server key, so a personal key is optional.</>
          )}
          {!hasServerKey && (
            <> This deployment has <strong>no</strong> server key — the AI features
            need your key to work.</>
          )}
        </p>

        <input
          ref={inputRef}
          type="password"
          className="mc-instruction"
          placeholder="sk-ant-…"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setWarn("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") onClose();
          }}
        />

        <p className="mc-hint">
          Get a key at{" "}
          <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>
          . Tip: create a key with a spending limit for use in web apps.
        </p>

        {warn && <div className="mc-error">{warn}</div>}

        <div className="mc-popover-actions">
          <button className="mc-btn-primary" onClick={save}>
            Save
          </button>
          {getApiKey() && (
            <button
              className="mc-btn"
              onClick={() => {
                setApiKey("");
                setValue("");
                onSaved(false);
                onClose();
              }}
            >
              Remove key
            </button>
          )}
          <button className="mc-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
