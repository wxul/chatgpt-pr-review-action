export function asset(value: any, message: string) {
  if (value) {
    throw new Error(message);
  }
}
