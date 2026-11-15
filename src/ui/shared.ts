/** The look every component shares: buttons, fields, chips, cards. The tokens are in index.html. */
import { css } from "lit";

export const base = css`
  :host {
    color: var(--ink);
    font-family: var(--font);
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  .icon {
    flex: none;
    display: block;
  }
  h2,
  h3 {
    margin: 0;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  h2 {
    font-size: 1.15rem;
  }
  h3 {
    font-size: 0.98rem;
  }
  .mono {
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
  }
  .dim {
    color: var(--dim);
  }
  .faint {
    color: var(--faint);
  }
  .label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--dim);
  }
  .hint {
    font-size: 0.85rem;
    color: var(--dim);
    margin: 0;
    line-height: 1.45;
  }

  /* buttons */
  button {
    font: inherit;
    color: inherit;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1.5px solid var(--hair-2);
    background: var(--surface);
    font-weight: 600;
    font-size: 0.88rem;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background 0.15s,
      border-color 0.15s,
      transform 0.1s;
  }
  .btn:hover {
    border-color: var(--ink);
  }
  .btn:active {
    transform: translateY(1px);
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: default;
    border-color: var(--hair-2);
  }
  .btn.primary {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }
  .btn.primary:hover {
    background: var(--pop);
    border-color: var(--pop);
    color: #fff;
  }
  .btn.ghost {
    border-color: transparent;
    background: transparent;
  }
  .btn.ghost:hover {
    background: var(--surface-2);
    border-color: var(--hair);
  }
  .btn.small {
    height: 28px;
    padding: 0 10px;
    font-size: 0.8rem;
  }
  .icon-btn {
    display: inline-grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 999px;
    border: none;
    background: transparent;
    color: var(--dim);
    cursor: pointer;
    flex: none;
  }
  .icon-btn:hover {
    background: var(--surface-2);
    color: var(--ink);
  }
  .icon-btn.danger:hover {
    color: var(--bad);
  }
  .icon-btn.on {
    background: var(--ink);
    color: var(--bg);
  }

  /* fields */
  input,
  select,
  textarea {
    font: inherit;
    font-size: 0.88rem;
    color: var(--ink);
    background: var(--field);
    border: 1.5px solid var(--hair);
    border-radius: 8px;
    padding: 5px 8px;
    min-width: 0;
    height: 32px;
  }
  textarea {
    height: auto;
    resize: vertical;
    line-height: 1.4;
  }
  input:hover,
  select:hover,
  textarea:hover {
    border-color: var(--hair-2);
  }
  input:focus,
  select:focus,
  textarea:focus {
    outline: none;
    border-color: var(--pop);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--pop) 22%, transparent);
  }
  input[type="number"],
  input[type="time"] {
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
  }
  input[type="time"] {
    width: 92px;
    padding-right: 4px;
  }
  input[type="number"] {
    width: 66px;
  }
  input[type="color"] {
    padding: 2px;
    width: 34px;
  }
  input[type="range"] {
    accent-color: var(--pop);
    border: none;
    background: transparent;
    padding: 0;
    height: 24px;
    box-shadow: none;
  }
  select {
    cursor: pointer;
  }
  .bare {
    border-color: transparent;
    background: transparent;
  }
  .bare:hover {
    border-color: var(--hair);
    background: var(--field);
  }

  /* segmented */
  .seg {
    display: inline-flex;
    padding: 3px;
    gap: 2px;
    border-radius: 999px;
    background: var(--surface-2);
    border: 1.5px solid var(--hair);
  }
  .seg button {
    border: none;
    background: transparent;
    padding: 4px 12px;
    border-radius: 999px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--dim);
  }
  .seg button:hover {
    color: var(--ink);
  }
  .seg button.on {
    background: var(--ink);
    color: var(--bg);
  }

  /* day toggles: M D W D V */
  .days {
    display: inline-flex;
    gap: 2px;
    flex: none;
  }
  .days button {
    width: 20px;
    height: 20px;
    border-radius: 6px;
    border: 1.5px solid var(--hair-2);
    background: transparent;
    font-size: 0.66rem;
    font-weight: 700;
    color: var(--faint);
    padding: 0;
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .days button.on {
    background: var(--day);
    border-color: var(--day);
    color: #fff;
  }
  .days button.today {
    outline: 2px solid var(--ink);
    outline-offset: 1px;
  }

  /* chips */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px 0 6px;
    border-radius: 999px;
    background: var(--surface);
    border: 1.5px solid var(--hair);
    font-size: 0.82rem;
    font-weight: 600;
    white-space: nowrap;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex: none;
    display: inline-block;
  }
  .sq {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    flex: none;
    display: inline-block;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    font-family: var(--mono);
    background: var(--surface-2);
    color: var(--dim);
  }
  .lic {
    display: inline-grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: 5px;
    font-size: 0.66rem;
    font-weight: 800;
    font-family: var(--mono);
    border: 1.5px solid currentColor;
  }
  .lic.d {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }

  /* cards */
  .card {
    background: var(--surface);
    border: 1.5px solid var(--hair);
    border-radius: var(--radius-lg);
    padding: 16px;
    box-shadow: var(--shadow);
    min-width: 0;
  }
  .card-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .wrap {
    flex-wrap: wrap;
  }
  .ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
