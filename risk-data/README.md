# risk-data

Versjonerte land-, bransje- og metodedata for risikoscreeningen. Format, livsløp og regler: [docs/decisions/0012-risikodata.md](../docs/decisions/0012-risikodata.md). Metoden: [docs/decisions/risk-method-v0.md](../docs/decisions/risk-method-v0.md).

- **`demo/`** har tre syntetiske filer som bare finnes for å vise formatet og kjøre tester lokalt. Nivåene er oppdiktet, landene er brukertildelte koder (`XA`–`XC`), og bransjekodene ligger i en ubrukt divisjon (`00`). De kan ikke aktiveres i produksjon og må aldri brukes på kundedata.
- **Ingen reelle data er sjekket inn.** Ekte land- og bransjedata krever avklart lisens, faglig gjennomgang og godkjenning før de legges hit med `environment: "production"`.

```bash
pnpm risk-data:validate
```

Les 0012 for import (`risk-data:import`) og aktivering (`risk-data:activate`). Begge bruker admin key fra en env-fil lokalt hos operatør.
