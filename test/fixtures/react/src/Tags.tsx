export function Tags({ tags }: { tags: string[] }) {
  return <ul>{tags.map((tag) => <li>{tag}</li>)}</ul>;
}
