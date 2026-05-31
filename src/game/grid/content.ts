// Bilingual board content for "The Grid".

export interface LocalizedString {
    en: string;
    pl: string;
}

export interface GridClue {
    value: number;
    clue: LocalizedString;
    answer: LocalizedString;
}

export interface GridContentCategory {
    title: LocalizedString;
    clues: GridClue[];
}

export interface GridContentPack {
    id: string;
    categories: GridContentCategory[];
}

const VALUES = [100, 200, 300, 400, 500];

const allBoard: GridContentPack = {
    id: 'all',
    categories: [
        {
            title: { en: 'World Capitals', pl: 'Stolice świata' },
            clues: [
                {
                    value: VALUES[0],
                    clue: { en: 'The capital of France.', pl: 'Stolica Francji.' },
                    answer: { en: 'Paris', pl: 'Paryż' },
                },
                {
                    value: VALUES[1],
                    clue: { en: 'The capital of Japan.', pl: 'Stolica Japonii.' },
                    answer: { en: 'Tokyo', pl: 'Tokio' },
                },
                {
                    value: VALUES[2],
                    clue: { en: 'The capital of Australia.', pl: 'Stolica Australii.' },
                    answer: { en: 'Canberra', pl: 'Canberra' },
                },
                {
                    value: VALUES[3],
                    clue: { en: 'The capital of Canada.', pl: 'Stolica Kanady.' },
                    answer: { en: 'Ottawa', pl: 'Ottawa' },
                },
                {
                    value: VALUES[4],
                    clue: { en: 'The capital of Kazakhstan.', pl: 'Stolica Kazachstanu.' },
                    answer: { en: 'Astana', pl: 'Astana' },
                },
            ],
        },
        {
            title: { en: 'Science', pl: 'Nauka' },
            clues: [
                {
                    value: VALUES[0],
                    clue: { en: 'The chemical symbol for water.', pl: 'Wzór chemiczny wody.' },
                    answer: { en: 'H2O', pl: 'H2O' },
                },
                {
                    value: VALUES[1],
                    clue: { en: 'The closest planet to the Sun.', pl: 'Najbliższa Słońcu planeta.' },
                    answer: { en: 'Mercury', pl: 'Merkury' },
                },
                {
                    value: VALUES[2],
                    clue: { en: 'The gas plants absorb during photosynthesis.', pl: 'Gaz pochłaniany przez rośliny w fotosyntezie.' },
                    answer: { en: 'Carbon dioxide', pl: 'Dwutlenek węgla' },
                },
                {
                    value: VALUES[3],
                    clue: { en: 'The number of bones in an adult human body.', pl: 'Liczba kości w ciele dorosłego człowieka.' },
                    answer: { en: '206', pl: '206' },
                },
                {
                    value: VALUES[4],
                    clue: { en: 'The scientist who proposed the theory of general relativity.', pl: 'Naukowiec, który stworzył ogólną teorię względności.' },
                    answer: { en: 'Albert Einstein', pl: 'Albert Einstein' },
                },
            ],
        },
        {
            title: { en: 'Movies', pl: 'Filmy' },
            clues: [
                {
                    value: VALUES[0],
                    clue: { en: 'The toy cowboy in "Toy Story".', pl: 'Kowboj-zabawka z „Toy Story".' },
                    answer: { en: 'Woody', pl: 'Chudy' },
                },
                {
                    value: VALUES[1],
                    clue: { en: 'The wizard school in the "Harry Potter" films.', pl: 'Szkoła czarodziejów w filmach o Harrym Potterze.' },
                    answer: { en: 'Hogwarts', pl: 'Hogwart' },
                },
                {
                    value: VALUES[2],
                    clue: { en: 'The director of "Jurassic Park" (1993).', pl: 'Reżyser „Parku Jurajskiego" (1993).' },
                    answer: { en: 'Steven Spielberg', pl: 'Steven Spielberg' },
                },
                {
                    value: VALUES[3],
                    clue: { en: 'The ship that sinks in the 1997 film by James Cameron.', pl: 'Statek, który tonie w filmie Jamesa Camerona z 1997 roku.' },
                    answer: { en: 'Titanic', pl: 'Titanic' },
                },
                {
                    value: VALUES[4],
                    clue: { en: 'The first feature-length animated film by Walt Disney.', pl: 'Pierwszy pełnometrażowy film animowany Walta Disneya.' },
                    answer: { en: 'Snow White and the Seven Dwarfs', pl: 'Królewna Śnieżka i siedmiu krasnoludków' },
                },
            ],
        },
        {
            title: { en: 'Sports', pl: 'Sport' },
            clues: [
                {
                    value: VALUES[0],
                    clue: { en: 'The number of players on a soccer team on the field.', pl: 'Liczba zawodników drużyny piłkarskiej na boisku.' },
                    answer: { en: '11', pl: '11' },
                },
                {
                    value: VALUES[1],
                    clue: { en: 'The sport played at Wimbledon.', pl: 'Sport rozgrywany na Wimbledonie.' },
                    answer: { en: 'Tennis', pl: 'Tenis' },
                },
                {
                    value: VALUES[2],
                    clue: { en: 'The country that hosts the Tour de France.', pl: 'Kraj, w którym odbywa się Tour de France.' },
                    answer: { en: 'France', pl: 'Francja' },
                },
                {
                    value: VALUES[3],
                    clue: { en: 'The number of rings on the Olympic flag.', pl: 'Liczba kół na fladze olimpijskiej.' },
                    answer: { en: '5', pl: '5' },
                },
                {
                    value: VALUES[4],
                    clue: { en: 'The boxer who called himself "The Greatest".', pl: 'Bokser, który nazywał siebie „Największym".' },
                    answer: { en: 'Muhammad Ali', pl: 'Muhammad Ali' },
                },
            ],
        },
        {
            title: { en: 'History', pl: 'Historia' },
            clues: [
                {
                    value: VALUES[0],
                    clue: { en: 'The wall that divided this German city until 1989.', pl: 'Mur, który dzielił to niemieckie miasto do 1989 roku.' },
                    answer: { en: 'Berlin', pl: 'Berlin' },
                },
                {
                    value: VALUES[1],
                    clue: { en: 'The first man to walk on the Moon.', pl: 'Pierwszy człowiek, który stanął na Księżycu.' },
                    answer: { en: 'Neil Armstrong', pl: 'Neil Armstrong' },
                },
                {
                    value: VALUES[2],
                    clue: { en: 'The ancient civilization that built the pyramids of Giza.', pl: 'Starożytna cywilizacja, która zbudowała piramidy w Gizie.' },
                    answer: { en: 'Egyptians', pl: 'Egipcjanie' },
                },
                {
                    value: VALUES[3],
                    clue: { en: 'The Polish astronomer who proposed a heliocentric model.', pl: 'Polski astronom, który stworzył model heliocentryczny.' },
                    answer: { en: 'Nicolaus Copernicus', pl: 'Mikołaj Kopernik' },
                },
                {
                    value: VALUES[4],
                    clue: { en: 'The year World War II ended.', pl: 'Rok zakończenia II wojny światowej.' },
                    answer: { en: '1945', pl: '1945' },
                },
            ],
        },
    ],
};

export const gridContentPacks: Record<string, GridContentPack> = {
    all: allBoard,
};

export function getGridPack(id: string = 'all'): GridContentPack {
    return gridContentPacks[id] ?? allBoard;
}
