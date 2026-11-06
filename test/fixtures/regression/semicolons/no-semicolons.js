export const log = []

export function run() {
  log.push("start")
  // log.push("old");
  ;[1, 2].forEach((value) => log.push(value))
  return log.join(",")
}

function forward(value) {
  return record(value)
}
;[3].forEach((value) => forward(value))

function record(value) {
  log.push(value)
  return value
}

export function count(limit) {
  let i
  for (i = 0; i < limit; i++) log.push(i)
  ;[4].forEach((value) => log.push(value))
  return log.length
}
