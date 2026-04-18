interface HeroActionLink {
  href: string;
  label: string;
  testId?: string;
}

interface HeroActionButton {
  disabled?: boolean;
  id: string;
  label: string;
  testId?: string;
  type?: "button" | "submit";
}

type HeroAction = HeroActionLink | HeroActionButton;

function isHeroActionLink(action: HeroAction): action is HeroActionLink {
  return "href" in action;
}

const CONTROLS_GUIDE_ITEMS = [
  { key: "WASD", label: "Move" },
  { key: "1", label: "Wall" },
  { key: "2", label: "Turret" },
  { key: "3", label: "Heater" },
  { key: "LMB", label: "Throw / Place" },
  { key: "Esc / RMB", label: "Cancel" }
] as const;

export interface SoloPageElements {
  backToSolo: HTMLButtonElement;
  bonfire: HTMLElement;
  build: HTMLElement;
  cooldown: HTMLElement;
  cursor: HTMLElement;
  hero: HTMLElement;
  hp: HTMLElement;
  lifecycle: HTMLElement;
  localName: HTMLElement;
  mode: HTMLElement;
  opponentHp: HTMLElement;
  opponentName: HTMLElement;
  opponentState: HTMLElement;
  packedSnow: HTMLElement;
  phase: HTMLElement;
  portalCopy: HTMLElement;
  position: HTMLElement;
  preview: HTMLElement;
  projectiles: HTMLElement;
  queueAgain: HTMLButtonElement;
  queueMeta: HTMLElement;
  queueStatusCode: HTMLElement;
  queueStatusStage: HTMLElement;
  queueToggle: HTMLButtonElement;
  readout: HTMLElement;
  resultOverlay: HTMLElement;
  resultOverlayReadout: HTMLElement;
  resultOverlayReason: HTMLElement;
  resultOverlayTitle: HTMLElement;
  resultRestart: HTMLButtonElement;
  reset: HTMLButtonElement;
  result: HTMLElement;
  resultActions: HTMLElement;
  root: HTMLDivElement;
  room: HTMLElement;
  roster: HTMLElement;
  snowLoad: HTMLElement;
  status: HTMLElement;
  structures: HTMLElement;
  time: HTMLElement;
  timerBadge: HTMLElement;
  viewport: HTMLElement;
}

export function renderControlsGuideCard(testIdPrefix: string) {
  return `
    <section class="overlay-card guide-card" data-testid="${testIdPrefix}-controls-guide">
      <div class="overlay-card-title">Controls</div>
      <ul class="guide-list">
        ${CONTROLS_GUIDE_ITEMS.map((item) => {
          return `
            <li class="guide-item">
              <kbd>${item.key}</kbd>
              <span>${item.label}</span>
            </li>
          `;
        }).join("")}
      </ul>
    </section>
  `;
}

export function renderHeroActions(actions: HeroAction[]) {
  return `
    <div class="hero-actions">
      ${actions
        .map((action) => {
          const testId = action.testId ? ` data-testid="${action.testId}"` : "";

          if (isHeroActionLink(action)) {
            return `<a class="secondary-link" href="${action.href}"${testId}>${action.label}</a>`;
          }

          const disabled = action.disabled ? " disabled" : "";
          const type = action.type ?? "button";
          return `
            <button
              class="secondary-link"
              id="${action.id}"
              type="${type}"${disabled}${testId}
            >
              ${action.label}
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

export function renderSoloPage(root: HTMLDivElement): SoloPageElements {
  root.innerHTML = `
    <div class="shell shell--solo" data-testid="solo-shell">
      <section class="hero hero--compact hero--solo" id="solo-hero">
        <h1 class="title">Blizzard<span>Brawl</span></h1>
        <p class="lede">
          Drop into a local solo arena immediately, keep practicing while duel queue runs in the
          background, and jump into live 1v1 the moment matchmaking finds a rival.
        </p>
        ${renderHeroActions([
          {
            disabled: true,
            id: "solo-reset",
            label: "Restart round",
            testId: "solo-reset"
          }
        ])}
      </section>
      <section class="arena">
        <div class="viewport" id="solo-viewport" data-testid="solo-viewport"></div>
        <div
          class="match-timer-badge"
          id="solo-timer-badge"
          data-testid="solo-timer-badge"
          hidden
        >
          02:00
        </div>
        <div
          class="result-overlay"
          id="solo-result-overlay"
          data-testid="solo-result-overlay"
          hidden
        >
          <div class="result-overlay-backdrop"></div>
          <section class="overlay-card result-overlay-card">
            <div class="overlay-card-title">Battle result</div>
            <h2
              class="result-overlay-title"
              id="solo-result-overlay-title"
              data-testid="solo-result-overlay-title"
            >
              Victory
            </h2>
            <div
              class="result result-overlay-reason"
              id="solo-result-overlay-reason"
              data-testid="solo-result-overlay-reason"
            ></div>
            <p
              class="status-copy result-overlay-readout"
              id="solo-result-overlay-readout"
              data-testid="solo-result-overlay-readout"
            ></p>
            <div class="hero-actions result-overlay-actions">
              <button
                class="primary-button"
                id="solo-result-restart"
                type="button"
                data-testid="solo-result-restart"
              >
                Restart round
              </button>
              <button
                class="secondary-link"
                id="solo-queue-again"
                type="button"
                data-testid="solo-queue-again"
              >
                Queue again
              </button>
              <button
                class="secondary-link"
                id="solo-back-to-solo"
                type="button"
                data-testid="solo-back-to-solo"
              >
                Back to solo
              </button>
            </div>
          </section>
        </div>
        <div class="overlay-stack overlay-stack--bottom-right">
          <section
            class="overlay-card status-card status-card--interactive"
            id="solo-status-card"
            data-testid="solo-status-card"
          >
            <div class="status-line status-line--compact">
              <span class="status-pill" id="solo-mode" data-testid="solo-mode">Solo sandbox</span>
              <span id="solo-status" data-testid="solo-status">Combat</span>
            </div>
            <div class="session-roster" id="solo-roster" data-testid="solo-roster">
              You vs Bot
            </div>
            <div class="session-meta-line" id="solo-queue-meta" data-testid="solo-queue-meta">
              Queue idle. Solo keeps running until you opt in.
            </div>
            <div class="status-copy" id="solo-readout" data-testid="solo-readout">
              Combat mode. Aim with the cursor and click to throw.
            </div>
            <button
              class="primary-button"
              id="solo-queue-toggle"
              type="button"
              data-testid="solo-queue-toggle"
            >
              Queue for duel
            </button>
            <div class="result" id="solo-result" data-testid="solo-result"></div>
            <div class="portal-copy" id="solo-portal-copy" data-testid="solo-portal-copy" hidden></div>
            <div class="hero-actions" id="solo-result-actions" hidden></div>
          </section>
        </div>
        <div class="overlay-stack overlay-stack--bottom-left">
          ${renderControlsGuideCard("solo")}
        </div>
        <div class="hidden-metrics" aria-hidden="true">
          <span data-testid="solo-phase" id="solo-phase">standard</span>
          <span data-testid="solo-time" id="solo-time">120</span>
          <span data-testid="solo-hp" id="solo-hp">100</span>
          <span data-testid="solo-packed-snow" id="solo-packed-snow">100</span>
          <span data-testid="solo-build" id="solo-build">combat</span>
          <span data-testid="solo-cursor" id="solo-cursor">0.0 / 0.0</span>
          <span data-testid="solo-position" id="solo-position">0.0 / 0.0</span>
          <span data-testid="solo-cooldown" id="solo-cooldown">ready</span>
          <span data-testid="solo-structures" id="solo-structures">0</span>
          <span data-testid="solo-projectiles" id="solo-projectiles">0</span>
          <span data-testid="solo-opponent-hp" id="solo-opponent-hp">100</span>
          <span data-testid="solo-preview" id="solo-preview">invalid</span>
          <span data-testid="solo-bonfire" id="solo-bonfire">idle</span>
          <span data-testid="solo-snow-load" id="solo-snow-load">0</span>
          <span data-testid="solo-opponent-state" id="solo-opponent-state">0.0 / 0.0</span>
          <span data-testid="solo-local-name" id="solo-local-name">You</span>
          <span data-testid="solo-opponent-name" id="solo-opponent-name">Bot</span>
          <span data-testid="solo-room" id="solo-room">local-solo</span>
          <span data-testid="solo-lifecycle" id="solo-lifecycle">in_match</span>
          <span data-testid="solo-queue-status-code" id="solo-queue-status-code">idle</span>
          <span data-testid="solo-queue-status-stage" id="solo-queue-status-stage">idle</span>
        </div>
      </section>
    </div>
  `;

  const elements = {
    backToSolo: requireElement<HTMLButtonElement>(root, "#solo-back-to-solo"),
    bonfire: requireElement<HTMLElement>(root, "#solo-bonfire"),
    build: requireElement<HTMLElement>(root, "#solo-build"),
    cooldown: requireElement<HTMLElement>(root, "#solo-cooldown"),
    cursor: requireElement<HTMLElement>(root, "#solo-cursor"),
    hero: requireElement<HTMLElement>(root, "#solo-hero"),
    hp: requireElement<HTMLElement>(root, "#solo-hp"),
    lifecycle: requireElement<HTMLElement>(root, "#solo-lifecycle"),
    localName: requireElement<HTMLElement>(root, "#solo-local-name"),
    mode: requireElement<HTMLElement>(root, "#solo-mode"),
    opponentHp: requireElement<HTMLElement>(root, "#solo-opponent-hp"),
    opponentName: requireElement<HTMLElement>(root, "#solo-opponent-name"),
    opponentState: requireElement<HTMLElement>(root, "#solo-opponent-state"),
    packedSnow: requireElement<HTMLElement>(root, "#solo-packed-snow"),
    phase: requireElement<HTMLElement>(root, "#solo-phase"),
    portalCopy: requireElement<HTMLElement>(root, "#solo-portal-copy"),
    position: requireElement<HTMLElement>(root, "#solo-position"),
    preview: requireElement<HTMLElement>(root, "#solo-preview"),
    projectiles: requireElement<HTMLElement>(root, "#solo-projectiles"),
    queueAgain: requireElement<HTMLButtonElement>(root, "#solo-queue-again"),
    queueMeta: requireElement<HTMLElement>(root, "#solo-queue-meta"),
    queueStatusCode: requireElement<HTMLElement>(root, "#solo-queue-status-code"),
    queueStatusStage: requireElement<HTMLElement>(root, "#solo-queue-status-stage"),
    queueToggle: requireElement<HTMLButtonElement>(root, "#solo-queue-toggle"),
    readout: requireElement<HTMLElement>(root, "#solo-readout"),
    resultOverlay: requireElement<HTMLElement>(root, "#solo-result-overlay"),
    resultOverlayReadout: requireElement<HTMLElement>(root, "#solo-result-overlay-readout"),
    resultOverlayReason: requireElement<HTMLElement>(root, "#solo-result-overlay-reason"),
    resultOverlayTitle: requireElement<HTMLElement>(root, "#solo-result-overlay-title"),
    resultRestart: requireElement<HTMLButtonElement>(root, "#solo-result-restart"),
    reset: requireElement<HTMLButtonElement>(root, "#solo-reset"),
    result: requireElement<HTMLElement>(root, "#solo-result"),
    resultActions: requireElement<HTMLElement>(root, "#solo-result-actions"),
    root,
    room: requireElement<HTMLElement>(root, "#solo-room"),
    roster: requireElement<HTMLElement>(root, "#solo-roster"),
    snowLoad: requireElement<HTMLElement>(root, "#solo-snow-load"),
    status: requireElement<HTMLElement>(root, "#solo-status"),
    structures: requireElement<HTMLElement>(root, "#solo-structures"),
    time: requireElement<HTMLElement>(root, "#solo-time"),
    timerBadge: requireElement<HTMLElement>(root, "#solo-timer-badge"),
    viewport: requireElement<HTMLElement>(root, "#solo-viewport")
  } satisfies SoloPageElements;

  return elements;
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing solo UI node: ${selector}`);
  }

  return element;
}
