export const writeupEnglish = {
  "agent-sudo": { title: "Agent Sudo", summary: "Web enumeration, FTP brute force, steganography, and privilege escalation through sudo." },
  blueprint: { title: "Blueprint", summary: "Remote code execution in osCommerce 2.3.4 on Windows and NTLM hash extraction." },
  "chocolate-factory": { title: "Chocolate Factory", summary: "Command injection, a PHP reverse shell, SSH access, and privilege escalation with vi." },
  "crack-the-hash": { title: "Crack the Hash", summary: "Hash identification and cracking with HashID, Hashcat, John the Ripper, and CrackStation." },
  fowsniff: { title: "Fowsniff CTF", summary: "OSINT, hash cracking, POP3 email access, and privilege escalation through vulnerable MOTD scripts." },
  "lazy-admin": { title: "LazyAdmin", summary: "Sweet Rice CMS enumeration, credentials exposed in a backup, a reverse shell, and privilege escalation." },
  lookup: { title: "Lookup", summary: "Brute forcing with ffuf, elFinder exploitation, PATH hijacking, and privilege escalation." },
  relevant: { title: "Relevant", summary: "A writable SMB share and Windows privilege escalation through token impersonation." },
  "simple-ctf": { title: "Simple CTF", summary: "Anonymous FTP, SQL injection in CMS Made Simple, SSH access, and escalation with vim." },
  tomghost: { title: "Tomghost", summary: "Ghostcat exploitation, SSH access, PGP key cracking, and sudo abuse through zip." },
} as const;

export const translateMetadata = (value: string) => ({
  Fácil: "Easy",
  Média: "Medium",
  Difícil: "Hard",
  Insana: "Insane",
  Outro: "Other",
}[value] || value);
