# Vorschau — Andreas Nagel

Passwortgeschützte Vorschau der Schwerpunktseite **Erbschaftsimmobilie**
(Entwurfsstand, noch nicht veröffentlicht).

## Was hier liegt

Vier statische Seiten, deren Inhalt **AES-256-GCM-verschlüsselt** im Quelltext
steht. Ohne das richtige Passwort liegt auf dem Server nur Chiffretext — auch
für Suchmaschinen, Crawler und jeden, der die Dateien direkt herunterlädt.
Bilder und Schriften sind in die verschlüsselten Seiten eingebettet, es gibt
keine ungeschützten Anhänge.

| Datei | Inhalt |
|---|---|
| `index.html` | Übersicht mit Einstieg und offenen Punkten |
| `erbschaftsimmobilie.html` | die Schwerpunktseite |
| `impressum.html` · `datenschutz.html` | Rechtstexte |
| `robots.txt` | `Disallow: /` für alle Crawler |
| `404.html` | schlichte Fehlerseite, ebenfalls auf `noindex` |

Jede Seite trägt zusätzlich `noindex,nofollow,noarchive,nosnippet,noimageindex`.

## Bedienung

Beim ersten Aufruf fragt die Seite nach dem Passwort. Es gilt für die gesamte
Browsersitzung, die Rechtstexte öffnen sich danach ohne erneute Eingabe. Beim
Schließen des Browsers wird es vergessen. Das Passwort steht **nicht** in
diesem Repository und wird separat weitergegeben.

## Technisch

- Schlüsselableitung: PBKDF2-HMAC-SHA256, 300 000 Runden, 16-Byte-Salt je Datei
- Verschlüsselung: AES-256-GCM, 12-Byte-IV, Authentifizierungs-Tag
- Entschlüsselung im Browser über die Web-Crypto-API, kein externes Skript
- Dauer der Entschlüsselung: unter einer Zehntelsekunde

## Neuen Stand einspielen

Die Quelldateien liegen außerhalb dieses Repositories im Arbeitsordner des
Projekts. Dort:

```
python3 build-export.py 'PASSWORT'     # erzeugt export-github-pages/
```

Danach den Inhalt von `export-github-pages/` in dieses Repository committen und
pushen. GitHub Pages veröffentlicht den Stand automatisch neu.

## Vor dem Livegang

Diese Vorschau wird nicht zur öffentlichen Seite. Nach der Freigabe durch
Andreas und den Steuerberater gehen die **unverschlüsselten** Dateien aus
`praesentation/` auf die Domain `maklernagel.de`; `robots.txt` und die
`noindex`-Angaben fallen dabei weg.
