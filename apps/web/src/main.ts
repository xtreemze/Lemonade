import "./styles.css";
import "./scene.css";
import "./history.css";
import "./finance.css";

import { LemonadeApp } from "./app.js";

const root = document.querySelector("#root");
if (!(root instanceof HTMLElement)) {
  throw new TypeError("Expected #root application mount point.");
}

new LemonadeApp(root);
