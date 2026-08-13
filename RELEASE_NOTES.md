# Release Notes

## [1.5.0] - 2026-08-13

### Fixed

- [PL] (Android) Postęp przeniesiony z innego urządzenia pojawia się teraz od razu. Wcześniej ekran główny pokazywał poziom 1 i zero punktów, dopóki nie weszło się w dowolny inny widok — wyglądało to jak utrata postępu, choć dane były całe.
- [EN] (Android) Progress brought over from another device now appears straight away. The home screen used to show level 1 and zero points until you opened another view — it looked like lost progress, though the data was intact.
- [PL] (Android) Powitanie po przeniesieniu postępu faktycznie się pokazuje. Na świeżej instalacji — czyli dokładnie wtedy, gdy ma sens — komunikat był pomijany.
- [EN] (Android) The greeting shown after progress is brought over now actually appears. On a fresh install — exactly when it matters — it was being skipped.

### App Store

<!-- PL -->

[Wersja: 1.5.0]
Poprawki wewnętrzne i optymalizacja.

<!-- EN -->

Version 1.5.0
Internal improvements and optimizations.

### Google Play

<!-- PL -->

[Wersja: 1.5.0]
Postęp przeniesiony z innego urządzenia pojawia się teraz od razu, a nie dopiero po wejściu w grę. Lisek wita cię też przy tej okazji.

<!-- EN -->

Version 1.5.0
Progress brought over from another device now appears straight away, instead of only after you opened a game. The fox greets you when it lands, too.

## [1.4.1] - 2026-08-04

The same version number carried different work on each store: iOS 1.4.1 shipped the
Game Center fix, Android 1.4.1 shipped cloud save.

### Added

- [PL] (Android) Postęp przenosi się między urządzeniami. Gdy jesteś zalogowany w Google Play Games, gra odnajduje na nowym telefonie twój poziom, zdobyte odznaki i rekordy.
- [EN] (Android) Progress carries across devices. While you are signed in to Google Play Games, the game finds your level, earned badges and best scores on a new phone.
- [PL] (Android) Postęp zapisany na urządzeniu nigdy nie zostaje zastąpiony.
- [EN] (Android) Progress saved on a device is never replaced.

### Fixed

- [PL] Osiągnięcia i rankingi zapowiedziane w 1.4.0 nie pokazywały się w Game Center na iOS — panel był pusty, a zdobyte odznaki nie trafiały na konto. Wszystko, co zdobyłeś wcześniej, pojawi się przy pierwszym uruchomieniu. Androida ten błąd nie dotyczył.
- [EN] The achievements and leaderboards announced in 1.4.0 never appeared in Game Center on iOS — the dashboard was empty and earned badges were not recorded. Everything earned before this update appears on first launch. Android was unaffected.

### App Store

<!-- PL -->

[Wersja: 1.4.1]
Osiągnięcia i rankingi z poprzedniej aktualizacji nie pokazywały się w Game Center. Już się pokazują — razem ze wszystkim, co zdobyłeś wcześniej. Nic nie przepadło.

<!-- EN -->

Version 1.4.1
The achievements and leaderboards from the last update weren't showing up in Game Center. Now they are — along with everything you had already earned. Nothing was lost.

### Google Play

<!-- PL -->

[Wersja: 1.4.1]
Twój postęp przenosi się teraz między urządzeniami. Zaloguj się do Google Play Games, a na nowym telefonie znajdziesz swój poziom, odznaki i rekordy. Postępu, który masz już na urządzeniu, gra nigdy nie zastąpi.

<!-- EN -->

Version 1.4.1
Your progress now moves between devices. Sign in to Google Play Games and your level, badges and best scores are waiting on a new phone. Progress already on a device is never replaced.

## [1.4.0] - 2026-07-31

### Added

- [PL] Osiągnięcia i rankingi w Game Center (iOS) oraz Google Play Games (Android) — 34 osiągnięcia i 3 rankingi najlepszych wyników, po jednym dla każdej gry. Wszystko, co zdobyłeś wcześniej, liczy się od razu.
- [EN] Achievements and leaderboards in Game Center (iOS) and Google Play Games (Android) — 34 achievements and 3 best-score leaderboards, one per game. Everything earned before this update counts immediately.
- [PL] Nowy wpis w zakładce Osiągnięcia otwiera systemowy panel platformy, gdzie widać odznaki i miejsca w rankingach.
- [EN] A new entry in the Achievements tab opens the platform's own dashboard, with badges and leaderboard standings.
- [PL] Lisek informuje o nowej wersji gry, a po aktualizacji pokazuje, co się zmieniło. Każdy komunikat pojawia się najwyżej raz na wersję i zamyka go dotknięcie poza okienkiem, przeciągnięcie w dół albo przycisk.
- [EN] The fox mentions when a new version is out, and shows what changed after you update. Each message appears at most once per version and closes with a tap outside, a swipe down, or a button.

### Fixed

- [PL] Wyzwanie odwołujące się do treści z nowszej wersji gry pokazywało ekran błędu zamiast komunikatu o wymaganej aktualizacji — i wracało przy każdym kolejnym otwarciu.
- [EN] A challenge referencing content from a newer build showed an error screen instead of the "update required" message, and recurred on every attempt to open it.
- [PL] Gra potrafiła się zamknąć przy odtwarzaniu dźwięku, gdy system nie pozwalał aktywować sesji audio — na przykład w tle albo w trybie oszczędzania energii.
- [EN] The app could close while playing a sound when the system refused to activate the audio session — in the background or in low power mode, for instance.

### App Store

<!-- PL -->

[Wersja: 1.4.0]
Twoje wyniki trafiają teraz do Game Center — zdobywaj osiągnięcia i sprawdzaj, jak wypadasz na tle innych graczy. Wszystko, co uzbierałeś do tej pory, liczy się od pierwszego uruchomienia. Naprawiliśmy też dwa błędy, przez które gra potrafiła się zamknąć.

<!-- EN -->

Version 1.4.0
Your results now sync to Game Center — unlock achievements and see how you stack up against other players. Everything you have earned so far counts from the moment you open the app. We also fixed two bugs that could close the game unexpectedly.

### Google Play

<!-- PL -->

[Wersja: 1.4.0]
Twoje wyniki trafiają teraz do Google Play Games — zdobywaj osiągnięcia i sprawdzaj, jak wypadasz na tle innych graczy. Wszystko, co uzbierałeś do tej pory, liczy się od pierwszego uruchomienia. Naprawiliśmy też dwa błędy, przez które gra potrafiła się zamknąć.

<!-- EN -->

Version 1.4.0
Your results now sync to Google Play Games — unlock achievements and see how you stack up against other players. Everything you have earned so far counts from the moment you open the app. We also fixed two bugs that could close the game unexpectedly.
