import { customAlphabet } from "nanoid";

const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZabcdefghjkmnpqrstvwxyz";

export const newId = customAlphabet(alphabet, 16);
