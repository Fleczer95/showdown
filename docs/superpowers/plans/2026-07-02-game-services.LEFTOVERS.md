# Game Services — co zostało do zrobienia ręcznie

> **Aktualizacja 2026-07-03 (sesja z użytkownikiem):** kroki 1 i 2 UKOŃCZONE ✅
> — ekran zgody OAuth utworzony, dwa klienty OAuth (Play Signing
> `57:BF:…:32:73` + Upload `37:74:…:5C:ED`) utworzone i podpięte jako dane
> logowania w Play Console (checklista 4/6). Został tylko krok 3 (publikacja,
> wymaga opisu + ikony 512px + grafiki w szczegółach gry — do zrobienia po
> testach; testerzy działają bez publikacji) oraz opcjonalne ikony osiągnięć.
> Dev-buildy z innej maszyny: dodać SHA-1 jej debug.keystore jako trzeci klient OAuth.

Stan po autonomicznej sesji 2026-07-03. Kod i provisioning sklepowy są ukończone
(szczegóły: `2026-07-02-game-services.md` + `.agents/game-services/SKILL.md`).
Poniższe trzy kroki wymagały decyzji właściciela konta (classifier zablokował
automatyczne utworzenie ekranu zgody OAuth) — łącznie ~5 minut klikania.

## 1. Ekran zgody OAuth (Google Cloud, projekt `showdown-tv-quiz`) — WYMAGANE

Bez tego nie da się dodać poświadczeń i sign-in Play Games nie działa na Androidzie.

1. https://console.cloud.google.com/auth/overview/create?project=showdown-tv-quiz
   (karta została otwarta w Chrome; formularz mógł się zresetować)
2. Informacje o aplikacji: nazwa **ShowDown**, e-mail pomocy: arturjankowski95@gmail.com
3. Odbiorcy: **Z zewnątrz** (External)
4. Dane kontaktowe: arturjankowski95@gmail.com
5. Zaznacz zgodę → **Utwórz**

## 2. Dane logowania Play Games (Play Console) — WYMAGANE

1. Play Console → ShowDown → Zwiększaj liczbę użytkowników → Usługi gier Play →
   Konfiguracja i zarządzanie → Konfiguracja → **Dodaj dane logowania**
2. Typ: **Android**, nazwa np. "ShowDown Android"
3. Autoryzacja: kreator utworzy klienta OAuth w `showdown-tv-quiz` — wskaż pakiet
   `com.showdown.app` i odcisk SHA-1 **klucza podpisywania Play App Signing**
   (Play Console → Konfiguracja → Integralność aplikacji → Podpisywanie aplikacji)
4. Powtórz dla **klucza uploadu** (i opcjonalnie debug keystore, jeśli chcesz
   testować sign-in na buildach z `expo run:android`):
   `keytool -list -v -keystore showdown-upload-key.keystore | grep SHA1`

## 3. Publikacja projektu gier (Play Console) — po testach

Konfiguracja (31 osiągnięć + 3 rankingi) jest w wersji roboczej — działa dla
testerów. Gdy przetestujesz: Konfiguracja → **Sprawdź i opublikuj**.

## Opcjonalne

- **Ikony osiągnięć na Androidzie** — API już ich nie przyjmuje; można dodać
  ręcznie w Play Console (gotowe PNG: `.agents/game-services/images/*.png`).
  Bez nich Play Games pokazuje placeholder.
- **iOS / Game Center**: nic nie blokuje — konfiguracja jest w App Store Connect
  w całości (osiągnięcia z obrazkami + rankingi EN/PL). Wejdzie w życie z
  najbliższym wydaniem aplikacji; wcześniej można testować w sandboxie na
  urządzeniu (konto sandbox / TestFlight).
- Przy najbliższej wersji w ASC upewnij się, że sekcja **Game Center** jest
  włączona na stronie wersji (jedno kliknięcie lub `gameCenterAppVersions` w API).
