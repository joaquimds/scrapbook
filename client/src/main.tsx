/* @refresh reload */
import { render } from "solid-js/web";
import { App } from "~/client/src/App.tsx";
import "~/client/src/styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
render(() => <App />, root);
