"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";

export function SaveButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="primary verve-primary" disabled={pending}>
      {pending ? "Saving…" : children}
    </button>
  );
}
type Choice = { id: string; label: string; detail: string };
export function ChoiceField({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: Choice[];
}) {
  const [filter, setFilter] = useState("");
  const [value, setValue] = useState("");
  const filtered = options.filter((o) =>
    (o.label + " " + o.detail)
      .toLowerCase()
      .includes(filter.toLowerCase().trim()),
  );
  return (
    <div className="field">
      {options.length > 25 && (
        <label className="field">
          Find {label}
          <input
            type="search"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setValue("");
            }}
            placeholder={"Search by " + label}
          />
        </label>
      )}
      <label className="field">
        Choose {label}
        <select
          name={name}
          value={value}
          required
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="" disabled>
            {filtered.length ? "Select " + label : "No matches"}
          </option>
          {filtered
            .slice(0, options.length > 25 ? 75 : options.length)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
                {o.detail ? " · " + o.detail : ""}
              </option>
            ))}
        </select>
      </label>
      {filtered.length > 75 && (
        <small>Showing 75 of {filtered.length}. Type to narrow the list.</small>
      )}
    </div>
  );
}
