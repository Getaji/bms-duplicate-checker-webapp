import { useEffect, useState, ChangeEventHandler } from "react";
import initSqlJs, { Database, ParamsObject, SqlJsStatic } from "sql.js";
import "./App.css";

type LR2SongRaw = {
  hash: string;
  title: string;
  subtitle: string;
  paths: string;
};

type LR2Song = {
  hash: string;
  title: string;
  subtitle: string;
  paths: string[];
};

type BeatorajaSongRaw = {
  md5: string;
  sha256: string;
  title: string;
  subtitle: string;
  paths: string;
};

type BeatorajaSong = {
  md5: string;
  sha256: string;
  title: string;
  subtitle: string;
  paths: string[];
};

function prepareAndGet<T extends ParamsObject>(db: Database, query: string) {
  const rows = [];
  const stmt = db.prepare(query);
  while (stmt.step()) {
    const row = stmt.getAsObject();
    rows.push(row as T);
  }
  stmt.free();
  return rows;
}

function getBeatorajaDuplicates(db: Database): BeatorajaSong[] {
  const rows = prepareAndGet<BeatorajaSongRaw>(
    db,
    `
    SELECT
      md5,
      max(sha256) AS sha256,
      title,
      subtitle,
      GROUP_CONCAT(path, '|') AS paths
    FROM song
    WHERE path <> ''
    GROUP BY sha256
    HAVING COUNT(sha256) > 1
    ORDER BY title, subtitle;
  `
  );

  console.log(rows);

  return rows.map((row) => ({
    ...row,
    paths: row.paths.split("|")
  }));
}

function getLR2Duplicates(db: Database) {
  const rows = prepareAndGet<LR2SongRaw>(
    db,
    `
    SELECT
      hash,
      title,
      subtitle,
      GROUP_CONCAT(path, '|') AS paths
    FROM song
    WHERE path <> ''
    GROUP BY hash
    HAVING COUNT(hash) > 1
    ORDER BY title, subtitle;
  `
  );

  return rows.map((row) => ({
    ...row,
    paths: row.paths.split("|")
  }));
}

function isLR2Song(song: LR2Song | BeatorajaSong): song is LR2Song {
  return "hash" in song;
}

function App() {
  const [status, setStatus] = useState("");
  const [isChecked, setChecked] = useState(false);
  const [isInitialized, setInitialized] = useState(false);
  const [sql, setSql] = useState<SqlJsStatic>();
  const [songs, setSongs] = useState<(LR2Song | BeatorajaSong)[]>([]);

  useEffect(() => {
    setStatus("初期化中……");
    initSqlJs({
      locateFile: (file) =>
        `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    }).then((sql) => {
      setSql(sql);
      setInitialized(true);
      setStatus("");
    });
  }, []);

  const onChangeFile: ChangeEventHandler<HTMLInputElement> = async (ev) => {
    if (!sql) return;

    if (!ev.target.files || !ev.target.files[0]) {
      setStatus("");
      setChecked(false);
      return;
    }

    const file = ev.target.files[0];
    if (file.name !== "songdata.db" && file.name !== "song.db") {
      setStatus("読み込み失敗: 不明なファイルがアップロードされました");
      setChecked(false);
      return alert("不明なファイルがアップロードされました");
    }

    setStatus("読み込み中……");

    const buffer = await file.arrayBuffer();
    let db;
    
    try {
      db = new sql.Database(new Uint8Array(buffer));
    } catch (e: any) {
      setStatus("読み込み失敗: " + String("message" in e ? e.message : e));
      setChecked(false);
      return;
    }

    if (file.name === "songdata.db") {
      setSongs(getBeatorajaDuplicates(db));
    } else {
      setSongs(getLR2Duplicates(db));
    }

    setStatus("読み込み完了");
    setChecked(true);
    db.close();
  };

  return (
    <div>
      <h1>所持BMS重複チェッカー</h1>
      <p>
        BMSプレイヤーに読み込まれているBMSの重複をチェックして表示します。
        <br />
        完全にブラウザ側で動作するので、DBのデータをサーバーに送信することはありません。
        <br />
        最新の主要なOS/ブラウザで動作するはずです。
      </p>
      <ul>
        <li>beatoraja: ルートディレクトリのsongdata.dbを選択</li>
        <li>LR2: LR2files/Databaseディレクトリのsong.dbを選択</li>
      </ul>
      <input
        type="file"
        accept=".db"
        onChange={onChangeFile}
        disabled={!isInitialized}
      />
      {status !== "" && <div>{status}</div>}
      {songs.length !== 0 && (
        <table>
          <thead>
            <tr>
              <th>タイトル</th>
              <th>パス</th>
              <th>LR2IR</th>
              <th>Mocha</th>
            </tr>
          </thead>
          <tbody>
            {songs.map((song) => (
              <tr key={isLR2Song(song) ? song.hash : song.sha256 ?? song.md5}>
                <td>
                  {song.title} {song.subtitle}
                </td>
                <td>
                  <ul>
                    {song.paths.map((path) => (
                      <li key={path}>{path}</li>
                    ))}
                  </ul>
                </td>
                <td>
                  <a
                    href={
                      "http://www.dream-pro.info/~lavalse/LR2IR/search.cgi?mode=ranking&bmsmd5=" +
                      (isLR2Song(song) ? song.hash : song.md5)
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    LR2IR
                  </a>
                </td>
                <td>
                  {!isLR2Song(song) && !!song.sha256 ? (
                    <a
                      href={
                        "https://mocha-repository.info/song.php?sha256=" +
                        song.sha256
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Mocha
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {isChecked && songs.length === 0 && (
        <p>重複は見つかりませんでした。綺麗なデータベースですね</p>
      )}
      <footer>Created by Getaji</footer>
    </div>
  );
}

export default App;
