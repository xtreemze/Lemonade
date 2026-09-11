import "./styles.css";
import "./scene.css";
import "./history.css";
import "./finance.css";

import { LemonadeApp, createFreshRunSnapshot } from "./app.js";
import { RunPersistenceError, clearCurrentRun, loadCurrentRun } from "./persistence.js";

const root = document.querySelector("#root");
if (!(root instanceof HTMLElement)) {
  throw new TypeError("Expected #root application mount point.");
}

const renderRecovery = (error: RunPersistenceError): void => {
  root.innerHTML = `
    <main class="game-shell bootstrap-shell">
      <section class="decision-panel bootstrap-recovery" aria-labelledby="recovery-title">
        <p class="eyebrow">Saved run recovery</p>
        <h1 id="recovery-title">Run could not be restored</h1>
        <p id="recovery-error" class="inline-error" role="alert"></p>
        <p>The saved document has been left untouched. You can discard it explicitly and begin a new run.</p>
        <button id="discard-saved-run" class="sell-button" type="button">Discard saved run and start new</button>
      </section>
    </main>
  `;

  const errorElement = root.querySelector("#recovery-error");
  const discardButton = root.querySelector("#discard-saved-run");
  if (!(errorElement instanceof HTMLElement) || !(discardButton instanceof HTMLButtonElement)) {
    throw new TypeError("Expected saved-run recovery controls.");
  }

  errorElement.textContent = error.message;
  discardButton.addEventListener(
    "click",
    () => {
      discardButton.disabled = true;
      void clearCurrentRun()
        .then(() => {
          window.location.reload();
        })
        .catch((clearError: unknown) => {
          discardButton.disabled = false;
          errorElement.textContent =
            clearError instanceof Error
              ? clearError.message
              : "Unable to clear browser run storage.";
        });
    },
    { once: true },
  );
};

const start = async (): Promise<void> => {
  try {
    const restored = await loadCurrentRun();
    new LemonadeApp(root, restored ?? createFreshRunSnapshot());
  } catch (error) {
    if (
      error instanceof RunPersistenceError &&
      (error.code === "storage-unavailable" || error.code === "storage-failed")
    ) {
      new LemonadeApp(root, createFreshRunSnapshot(), {
        persistenceEnabled: false,
        initialPersistenceError: error.message,
      });
      return;
    }

    if (error instanceof RunPersistenceError) {
      renderRecovery(error);
      return;
    }

    throw error;
  }
};

void start();
