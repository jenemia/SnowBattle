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
  reset: HTMLButtonElement;
  root: HTMLDivElement;
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
      <section class="hero hero--compact hero--solo">
        <div class="eyebrow">Solo Movement Lab · Local Rules</div>
        <h1 class="title">Blizzard<span>Brawl</span></h1>
        <p class="lede">
          A local-first duel harness for combat, builds, and pacing. Everything runs in-browser
          with the same shared rules engine used by live duels.
        </p>
        ${renderHeroActions([
          {
            href: "./",
            label: "Back to duel home",
            testId: "solo-home-link"
          },
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
        <div class="overlay-stack overlay-stack--bottom-left">
          ${renderControlsGuideCard("solo")}
        </div>
      </section>
    </div>
  `;

  const viewport = root.querySelector<HTMLElement>("#solo-viewport");
  const reset = root.querySelector<HTMLButtonElement>("#solo-reset");

  if (!viewport || !reset) {
    throw new Error("Missing solo UI nodes");
  }

  return {
    reset,
    root,
    viewport
  };
}
