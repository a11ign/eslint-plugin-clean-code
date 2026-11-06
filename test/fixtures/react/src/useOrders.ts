import React, { type ReactElement } from "react";

export function useOrders(rows: ReactElement[]) {
  return rows.map((row, index) => React.cloneElement(row, { key: index }));
}
