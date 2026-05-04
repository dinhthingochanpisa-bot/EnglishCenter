export class PhoneUtility {
  /**
   * Normalizes a phone number by removing all non-numeric characters.
   * Example: "+84 988-000-111" -> "84988000111"
   * Example: "0988.000.111" -> "0988000111"
   */
  static normalize(phone: string): string {
    if (!phone) return '';
    let normalized = phone.replace(/\D/g, '');

    // Handle Vietnam specific country code: 84 followed by standard lengths
    if (normalized.startsWith('84')) {
      normalized = '0' + normalized.substring(2);
    }

    // Some formats might not even have 0 if someone typed "988 000 111"
    if (!normalized.startsWith('0') && normalized.length === 9) {
      normalized = '0' + normalized;
    }

    return normalized;
  }

  /**
   * Compares two phone numbers after normalization.
   */
  static isSame(phone1: string, phone2: string): boolean {
    return this.normalize(phone1) === this.normalize(phone2);
  }
}
