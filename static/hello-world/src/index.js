import React from "react";
import ReactDOM from "react-dom";
import { view } from "@forge/bridge";
import App from "./App";

view.getContext().then(function (context) {
  ReactDOM.render(
    <App context={context} />,
    document.getElementById("root")
  );
});
