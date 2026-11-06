export function Panel({ title, body, footer }: { title: string; body: string; footer: string }) {
  return (
    <section>
      <header>
        <h2>{title}</h2>
      </header>
      <div>
        <p>{body}</p>
      </div>
      <aside>
        <p>{title}</p>
      </aside>
      <footer>
        <p>{footer}</p>
      </footer>
      <hr />
      <small>{footer}</small>
    </section>
  );
}
