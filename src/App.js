import './App.css';
import Main from './layouts/main'
import Header from './layouts/header';

function App() {
  return (
    <div className="App">
      <header>
        <div className="content">
          <Header />
        </div>
      </header>
      <main>
        <div className="content">
          <Main />
        </div>
      </main>
    </div>
  );
}

export default App;
