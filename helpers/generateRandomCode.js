export function generateRandomCode() {
  return [...Array(10)].map(() => Math.random().toString(36)[2]).join("");
}
