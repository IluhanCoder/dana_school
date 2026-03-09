import { BrowserRouter } from "react-router-dom";
import Header from "./components/Header";
import Router from "./router";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen">
        <Header />
        <main className="flex-1 overflow-auto">
          <Router />
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
