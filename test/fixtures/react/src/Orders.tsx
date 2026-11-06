import { Row } from "./Row.tsx";

export function Orders({ orders }: { orders: string[] }) {
  return <ul>{orders.map((order, index) => <Row key={index} label={order} />)}</ul>;
}
