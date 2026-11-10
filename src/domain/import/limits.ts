/**
 * Grenser og valg for CSV-import. Egen fil uten avhengigheter, så nettleseren
 * kan avvise for store filer før opplasting uten å laste CSV-biblioteket.
 */
export const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MiB
export const MAX_ROWS = 2000;
export const MAX_COLUMNS = 50;

export const DELIMITERS = [";", ","] as const;
export type Delimiter = (typeof DELIMITERS)[number];

/** Hvilket tegn som er desimaltegn i beløp. «auto» godtar begge og melder fra når et beløp kan leses på to måter. */
export const DECIMAL_FORMATS = ["auto", "comma", "dot"] as const;
export type DecimalFormat = (typeof DECIMAL_FORMATS)[number];

export const FILE_TOO_LARGE_MESSAGE = "Filen er for stor. Største tillatte størrelse er 2 MB.";
