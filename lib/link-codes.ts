/**
 * Generates a link code of the form EDU-XXXX-XX with unambiguous characters.
 */
export function generateLinkCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const random = (n: number) =>
    Array.from({ length: n }, () =>
      alphabet[Math.floor(Math.random() * alphabet.length)]
    ).join("");
  return `EDU-${random(4)}-${random(2)}`;
}