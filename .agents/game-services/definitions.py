"""Single source of truth for store-side game services config (both stores).

Mirrors src/game/progression/achievements.ts (7 tiered families x 3 + 10 one-offs)
and the three best-score leaderboards. Names/descriptions come from the app's
i18n files with thresholds interpolated; Apple display names stay <= 30 chars.
"""

APP_BUNDLE = "com.showdown.app"

TIERS = [("bronze", 10), ("silver", 25), ("gold", 50)]
TIER_LABEL = {
    "bronze": {"en": "Bronze", "pl": "Brąz"},
    "silver": {"en": "Silver", "pl": "Srebro"},
    "gold": {"en": "Gold", "pl": "Złoto"},
}
ONE_OFF_POINTS = 25


def _en_num(n):
    return f"{n:,}"


def _pl_num(n):
    return f"{n:,}".replace(",", " ")


# family -> (en name, pl name, en desc template, pl desc template, thresholds)
FAMILIES = [
    ("contestant", "Contestant", "Uczestnik", "Play {n} runs", "Rozegraj {n} rozgrywek", [10, 50, 200]),
    ("on-a-roll", "On a Roll", "Dobra passa", "Reach a {n}-day streak", "Osiągnij passę {n} dni", [3, 7, 30]),
    ("regular", "Regular", "Bywalec", "Play on {n} separate days", "Zagraj w {n} różnych dniach", [5, 15, 40]),
    ("winner", "Winner", "Zwycięzca", "Win {n} games", "Wygraj {n} gier", [5, 25, 100]),
    (
        "ladder-scorer",
        "Climb Scorer",
        "Wynik: Na Szczyt",
        "Score {n} in a single Climb run",
        "Zdobądź {n} punktów w jednej rozgrywce gry Na Szczyt",
        [8000, 15000, 22000],
    ),
    (
        "drop-scorer",
        "Drop Scorer",
        "Wynik: Zrzut",
        "Score {n} in a single Drop run",
        "Zdobądź {n} punktów w jednej rozgrywce Zrzutu",
        [200000, 600000, 1200000],
    ),
    (
        "wheel-scorer",
        "Letter Wheel Scorer",
        "Wynik: Koło Liter",
        "Score {n} in a single Letter Wheel run",
        "Zdobądź {n} punktów w jednej rozgrywce Koła Liter",
        [5000, 10000, 18000],
    ),
]

# id -> (en name, pl name, en desc, pl desc)
ONE_OFFS = [
    (
        "well-rounded",
        "Well-Rounded",
        "Wszechstronny",
        "Win each of the three games at least once",
        "Wygraj każdą z trzech gier przynajmniej raz",
    ),
    (
        "triple-threat",
        "Triple Threat",
        "Potrójne zagrożenie",
        "Play all three games in one day",
        "Zagraj we wszystkie trzy gry jednego dnia",
    ),
    (
        "to-the-top",
        "To the Top",
        "Na sam szczyt",
        "Reach Rung 15 on The Climb",
        "Dotrzyj do 15. szczebla w grze Na Szczyt",
    ),
    (
        "spotless",
        "Spotless",
        "Bez skazy",
        "Win a Climb run using no lifelines",
        "Wygraj rozgrywkę gry Na Szczyt bez użycia kół ratunkowych",
    ),
    (
        "survivor",
        "Survivor",
        "Ocalały",
        "Survive all 9 rounds of The Drop",
        "Przetrwaj wszystkie 9 rund Zrzutu",
    ),
    (
        "iron-bank",
        "Iron Bank",
        "Żelazny bank",
        "Finish The Drop keeping at least half the starting bank",
        "Zakończ Zrzut, zachowując co najmniej połowę banku",
    ),
    (
        "vowel-free",
        "Vowel-Free",
        "Bez samogłosek",
        "Solve a Letter Wheel puzzle without buying a vowel",
        "Rozwiąż zagadkę Koła Liter bez kupowania samogłoski",
    ),
    (
        "clean-sweep",
        "Clean Sweep",
        "Czyste zwycięstwo",
        "Solve all 3 Letter Wheel puzzles in one run",
        "Rozwiąż wszystkie 3 zagadki Koła Liter w jednej rozgrywce",
    ),
    (
        "quick-wit",
        "Quick Wit",
        "Bystry umysł",
        "Answer under 5s at a high rung on The Climb",
        "Odpowiedz w mniej niż 5 s na wysokim szczeblu gry Na Szczyt",
    ),
    (
        "comeback",
        "Comeback",
        "Powrót",
        "Solve a Letter Wheel puzzle after recovering from a Bankrupt",
        "Rozwiąż zagadkę Koła Liter po odrobieniu Bankructwa",
    ),
]


def apple_ach_id(local_id):
    return f"{APP_BUNDLE}.ach.{local_id.replace('-', '_')}"


def apple_lb_id(game_id):
    return f"{APP_BUNDLE}.lb.{game_id.replace('-', '_')}"


def achievements():
    """All 31 achievements, in display order."""
    out = []
    for family, en_name, pl_name, en_desc, pl_desc, thresholds in FAMILIES:
        for (tier, points), n in zip(TIERS, thresholds):
            local_id = f"{family}-{tier}"
            out.append(
                {
                    "id": local_id,
                    "apple_id": apple_ach_id(local_id),
                    "points": points,
                    "tier": tier,
                    "en": {
                        "name": f"{en_name} · {TIER_LABEL[tier]['en']}",
                        "desc": en_desc.format(n=_en_num(n)),
                    },
                    "pl": {
                        "name": f"{pl_name} · {TIER_LABEL[tier]['pl']}",
                        "desc": pl_desc.format(n=_pl_num(n)),
                    },
                }
            )
    for local_id, en_name, pl_name, en_desc, pl_desc in ONE_OFFS:
        out.append(
            {
                "id": local_id,
                "apple_id": apple_ach_id(local_id),
                "points": ONE_OFF_POINTS,
                "tier": None,
                "en": {"name": en_name, "desc": en_desc},
                "pl": {"name": pl_name, "desc": pl_desc},
            }
        )
    return out


LEADERBOARDS = [
    {
        "id": "the-ladder",
        "apple_id": apple_lb_id("the-ladder"),
        "en": "The Climb · Best Score",
        "pl": "Na Szczyt · najlepszy wynik",
    },
    {
        "id": "the-drop",
        "apple_id": apple_lb_id("the-drop"),
        "en": "The Drop · Best Score",
        "pl": "Zrzut · najlepszy wynik",
    },
    {
        "id": "the-wheel",
        "apple_id": apple_lb_id("the-wheel"),
        "en": "Letter Wheel · Best Score",
        "pl": "Koło Liter · najlepszy wynik",
    },
]


if __name__ == "__main__":
    achs = achievements()
    total = sum(a["points"] for a in achs)
    assert len(achs) == 31, len(achs)
    assert total <= 1000, total
    for a in achs:
        for loc in ("en", "pl"):
            assert len(a[loc]["name"]) <= 30, (a["id"], loc, a[loc]["name"])
    for lb in LEADERBOARDS:
        assert len(lb["en"]) <= 30 and len(lb["pl"]) <= 30, lb
    print(f"{len(achs)} achievements, {total} Apple points, names within limits ✓")
