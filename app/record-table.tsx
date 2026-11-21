"use client";
import { useRef, useState } from "react";
import { completeAction,releaseSubmission } from "./operations";

type Item = {
  id: string;
  cells: string[];
  source?: string;
  openAction: boolean;
  canRelease?:boolean;
};
export function RecordTable({
  headers,
  rows,
  filterPage,
  view,
}: {
  headers: string[];
  rows: Item[];
  filterPage: boolean;
  view: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Item>();
  const dialog = useRef<HTMLDialogElement>(null);
  const visible = rows.filter((row) =>
    row.cells.some((c) => c.toLowerCase().includes(query.trim().toLowerCase())),
  );
  return (
    <>
      {filterPage && (
        <label className="search">
          <span className="sr-only">Filter this page</span>
          <input
            placeholder="Filter this page"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                {row.cells.map((c, i) => (
                  <td key={i} data-label={headers[i]}>
                    {i === 0 ? (
                      <button
                        className="row-link"
                        onClick={() => {
                          setSelected(row);
                          dialog.current?.showModal();
                        }}
                      >
                        {c}
                      </button>
                    ) : (
                      c || "—"
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && <p>No matching records on this page.</p>}
      </div>
      <dialog
        ref={dialog}
        aria-labelledby="record-title"
        className="record-dialog"
      >
        <button
          className="close"
          aria-label="Close details"
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
        {selected && (
          <>
            <h2 id="record-title">{selected.cells[0]}</h2>
            <dl>
              {headers.slice(1).map((h, i) => (
                <div key={h}>
                  <dt>{h}</dt>
                  <dd>{selected.cells[i + 1] || "Not recorded"}</dd>
                </div>
              ))}
            </dl>
            {selected.source && (
              <a href={selected.source} target="_blank" rel="noreferrer">
                Open source tracker
              </a>
            )}
            {selected.canRelease&&<form action={releaseSubmission} className="field"><input type="hidden" name="id" value={selected.id}/><label><input type="checkbox" required name="confirm" value="yes"/> Share this candidate name, role and stage with {selected.cells[2]}.</label><button className="outline">Share with partner</button></form>}
            {selected.openAction && (
              <form action={completeAction}>
                <input type="hidden" name="view" value={view} />
                <input type="hidden" name="id" value={selected.id} />
                <button className="primary verve-primary">Mark complete</button>
              </form>
            )}
          </>
        )}
      </dialog>
    </>
  );
}
