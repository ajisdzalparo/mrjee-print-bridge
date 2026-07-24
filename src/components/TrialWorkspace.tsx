interface Props {
  port: number;
  onActivate: () => void;
}

export default function TrialWorkspace({ port, onActivate }: Props) {
  return (
    <div className="trial-workspace">
      <div className="trial-card">
        <div className="trial-badge">TRIAL MODE · NO LICENSE REQUIRED</div>
        <img src="/icon.png" alt="Mrjee Print Bridge" />
        <h1>Bridge siap untuk test print.</h1>
        <p>
          Biarkan aplikasi ini tetap berjalan, lalu buka halaman demo resmi.
          Website akan mendeteksi semua printer Windows dan mengirim payload test
          bawaan ke printer yang Anda pilih.
        </p>
        <div className="trial-status">
          <i />
          <div><b>LOCAL BRIDGE ONLINE</b><code>http://localhost:{port}</code></div>
        </div>
        <div className="trial-steps">
          <span><b>1</b> Buka halaman demo</span>
          <span><b>2</b> Connect &amp; scan printers</span>
          <span><b>3</b> Pilih printer dan test</span>
        </div>
        <a href="https://print.mrjee.id/demo" target="_blank" rel="noreferrer">
          Open Official Print Demo ↗
        </a>
        <button type="button" onClick={onActivate}>I already have a license</button>
        <small>
          Trial tidak menerima dokumen bebas, tidak membuka production API, dan
          tidak dapat digunakan untuk operasional harian.
        </small>
      </div>
    </div>
  );
}
