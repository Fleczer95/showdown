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
                { value: VALUES[0], clue: { en: 'The capital of France.', pl: 'Stolica Francji.' }, answer: { en: 'Paris', pl: 'Paryż' } },
                { value: VALUES[1], clue: { en: 'The capital of Japan.', pl: 'Stolica Japonii.' }, answer: { en: 'Tokyo', pl: 'Tokio' } },
                { value: VALUES[2], clue: { en: 'The capital of Australia.', pl: 'Stolica Australii.' }, answer: { en: 'Canberra', pl: 'Canberra' } },
                { value: VALUES[3], clue: { en: 'The capital of Canada.', pl: 'Stolica Kanady.' }, answer: { en: 'Ottawa', pl: 'Ottawa' } },
                { value: VALUES[4], clue: { en: 'The capital of Iceland.', pl: 'Stolica Islandii.' }, answer: { en: 'Reykjavik', pl: 'Reykjavik' } },
            ],
        },
        {
            title: { en: 'Science', pl: 'Nauka' },
            clues: [
                { value: VALUES[0], clue: { en: 'The chemical symbol for water.', pl: 'Wzór chemiczny wody.' }, answer: { en: 'H2O', pl: 'H2O' } },
                { value: VALUES[1], clue: { en: 'The closest planet to the Sun.', pl: 'Najbliższa Słońcu planeta.' }, answer: { en: 'Mercury', pl: 'Merkury' } },
                { value: VALUES[2], clue: { en: 'The gas plants absorb during photosynthesis.', pl: 'Gaz pochłaniany przez rośliny w fotosyntezie.' }, answer: { en: 'Carbon dioxide', pl: 'Dwutlenek węgla' } },
                { value: VALUES[3], clue: { en: 'The number of bones in an adult human body.', pl: 'Liczba kości w ciele dorosłego człowieka.' }, answer: { en: '206', pl: '206' } },
                { value: VALUES[4], clue: { en: 'The scientist who proposed the theory of general relativity.', pl: 'Naukowiec, który stworzył ogólną teorię względności.' }, answer: { en: 'Albert Einstein', pl: 'Albert Einstein' } },
            ],
        },
        {
            title: { en: 'Movies', pl: 'Filmy' },
            clues: [
                { value: VALUES[0], clue: { en: 'The toy cowboy in "Toy Story".', pl: 'Kowboj-zabawka z „Toy Story".' }, answer: { en: 'Woody', pl: 'Chudy' } },
                { value: VALUES[1], clue: { en: 'The wizard school in the "Harry Potter" films.', pl: 'Szkoła czarodziejów w filmach o Harrym Potterze.' }, answer: { en: 'Hogwarts', pl: 'Hogwart' } },
                { value: VALUES[2], clue: { en: 'The director of "Jurassic Park" (1993).', pl: 'Reżyser „Parku Jurajskiego" (1993).' }, answer: { en: 'Steven Spielberg', pl: 'Steven Spielberg' } },
                { value: VALUES[3], clue: { en: 'The ship that sinks in the 1997 film by James Cameron.', pl: 'Statek, który tonie w filmie Jamesa Camerona z 1997 roku.' }, answer: { en: 'Titanic', pl: 'Titanic' } },
                { value: VALUES[4], clue: { en: 'The first feature-length animated film by Walt Disney.', pl: 'Pierwszy pełnometrażowy film animowany Walta Disneya.' }, answer: { en: 'Snow White', pl: 'Królewna Śnieżka' } },
            ],
        },
        {
            title: { en: 'Sports', pl: 'Sport' },
            clues: [
                { value: VALUES[0], clue: { en: 'The number of players on a soccer team on the field.', pl: 'Liczba zawodników drużyny piłkarskiej na boisku.' }, answer: { en: '11', pl: '11' } },
                { value: VALUES[1], clue: { en: 'The sport played at Wimbledon.', pl: 'Sport rozgrywany na Wimbledonie.' }, answer: { en: 'Tennis', pl: 'Tenis' } },
                { value: VALUES[2], clue: { en: 'The country that hosts the Tour de France.', pl: 'Kraj, w którym odbywa się Tour de France.' }, answer: { en: 'France', pl: 'Francja' } },
                { value: VALUES[3], clue: { en: 'The number of rings on the Olympic flag.', pl: 'Liczba kół na fladze olimpijskiej.' }, answer: { en: '5', pl: '5' } },
                { value: VALUES[4], clue: { en: 'The boxer who called himself "The Greatest".', pl: 'Bokser, który nazywał siebie „Największym".' }, answer: { en: 'Muhammad Ali', pl: 'Muhammad Ali' } },
            ],
        },
        {
            title: { en: 'History', pl: 'Historia' },
            clues: [
                { value: VALUES[0], clue: { en: 'The wall that divided Berlin until 1989.', pl: 'Mur, który dzielił Berlin do 1989 roku.' }, answer: { en: 'Berlin Wall', pl: 'Mur Berliński' } },
                { value: VALUES[1], clue: { en: 'The first man to walk on the Moon.', pl: 'Pierwszy człowiek, który stanął na Księżycu.' }, answer: { en: 'Neil Armstrong', pl: 'Neil Armstrong' } },
                { value: VALUES[2], clue: { en: 'The ancient civilization that built the pyramids.', pl: 'Starożytna cywilizacja, która zbudowała piramidy.' }, answer: { en: 'Egyptians', pl: 'Egipcjanie' } },
                { value: VALUES[3], clue: { en: 'The Polish astronomer who "stopped the Sun".', pl: 'Polski astronom, który „wstrzymał Słońce”.' }, answer: { en: 'Copernicus', pl: 'Kopernik' } },
                { value: VALUES[4], clue: { en: 'The year World War II ended.', pl: 'Rok zakończenia II wojny światowej.' }, answer: { en: '1945', pl: '1945' } },
            ],
        },
        {
            title: { en: 'Literature', pl: 'Literatura' },
            clues: [
                { value: VALUES[0], clue: { en: 'The author of "Romeo and Juliet".', pl: 'Autor „Romeo i Julii”.' }, answer: { en: 'Shakespeare', pl: 'Szekspir' } },
                { value: VALUES[1], clue: { en: 'The detective living at 221B Baker Street.', pl: 'Detektyw mieszkający przy Baker Street 221B.' }, answer: { en: 'Sherlock Holmes', pl: 'Sherlock Holmes' } },
                { value: VALUES[2], clue: { en: 'The fictional land in "The Lion, the Witch and the Wardrobe".', pl: 'Fikcyjna kraina z książki „Lew, Czarownica i stara szafa”.' }, answer: { en: 'Narnia', pl: 'Narnia' } },
                { value: VALUES[3], clue: { en: 'The author of "The Little Prince".', pl: 'Autor „Małego Księcia”.' }, answer: { en: 'Saint-Exupéry', pl: 'Saint-Exupéry' } },
                { value: VALUES[4], clue: { en: 'The school of witchcraft and wizardry.', pl: 'Szkoła magii i czarodziejstwa.' }, answer: { en: 'Hogwarts', pl: 'Hogwart' } },
            ],
        },
        {
            title: { en: 'Geography', pl: 'Geografia' },
            clues: [
                { value: VALUES[0], clue: { en: 'The largest continent.', pl: 'Największy kontynent.' }, answer: { en: 'Asia', pl: 'Azja' } },
                { value: VALUES[1], clue: { en: 'The river flowing through Egypt.', pl: 'Rzeka płynąca przez Egipt.' }, answer: { en: 'Nile', pl: 'Nil' } },
                { value: VALUES[2], clue: { en: 'The smallest country in the world.', pl: 'Najmniejszy kraj świata.' }, answer: { en: 'Vatican City', pl: 'Watykan' } },
                { value: VALUES[3], clue: { en: 'The mountain range where Everest is located.', pl: 'Pasmo górskie, w którym leży Mount Everest.' }, answer: { en: 'Himalayas', pl: 'Himalaje' } },
                { value: VALUES[4], clue: { en: 'The country with the largest population.', pl: 'Kraj z największą liczbą ludności.' }, answer: { en: 'India', pl: 'Indie' } },
            ],
        },
        {
            title: { en: 'Music', pl: 'Muzyka' },
            clues: [
                { value: VALUES[0], clue: { en: 'The instrument with 88 keys.', pl: 'Instrument z 88 klawiszami.' }, answer: { en: 'Piano', pl: 'Pianino' } },
                { value: VALUES[1], clue: { en: 'The "King of Pop".', pl: '„Król Popu”.' }, answer: { en: 'Michael Jackson', pl: 'Michael Jackson' } },
                { value: VALUES[2], clue: { en: 'The number of strings on a standard guitar.', pl: 'Liczba strun w standardowej gitarze.' }, answer: { en: '6', pl: '6' } },
                { value: VALUES[3], clue: { en: 'The lead singer of Queen.', pl: 'Lider zespołu Queen.' }, answer: { en: 'Freddie Mercury', pl: 'Freddie Mercury' } },
                { value: VALUES[4], clue: { en: 'The composer of the "Moonlight Sonata".', pl: 'Kompozytor „Sonaty Księżycowej”.' }, answer: { en: 'Beethoven', pl: 'Beethoven' } },
            ],
        },
        {
            title: { en: 'Technology', pl: 'Technologia' },
            clues: [
                { value: VALUES[0], clue: { en: 'The company that created the iPhone.', pl: 'Firma, która stworzyła iPhone’a.' }, answer: { en: 'Apple', pl: 'Apple' } },
                { value: VALUES[1], clue: { en: 'The "World Wide Web" inventor.', pl: 'Twórca sieci World Wide Web.' }, answer: { en: 'Tim Berners-Lee', pl: 'Tim Berners-Lee' } },
                { value: VALUES[2], clue: { en: 'The main component of a computer (brain).', pl: 'Główny komponent komputera (jego mózg).' }, answer: { en: 'CPU', pl: 'Procesor' } },
                { value: VALUES[3], clue: { en: 'The largest search engine.', pl: 'Największa wyszukiwarka internetowa.' }, answer: { en: 'Google', pl: 'Google' } },
                { value: VALUES[4], clue: { en: 'The first programmer in history.', pl: 'Pierwsza programistka w historii.' }, answer: { en: 'Ada Lovelace', pl: 'Ada Lovelace' } },
            ],
        },
        {
            title: { en: 'Mythology', pl: 'Mitologia' },
            clues: [
                { value: VALUES[0], clue: { en: 'The king of the Greek gods.', pl: 'Król greckich bogów.' }, answer: { en: 'Zeus', pl: 'Zeus' } },
                { value: VALUES[1], clue: { en: 'The god of the sea (Greek).', pl: 'Bóg mórz (grecki).' }, answer: { en: 'Poseidon', pl: 'Posejdon' } },
                { value: VALUES[2], clue: { en: 'The hero who performed 12 labors.', pl: 'Bohater, który wykonał 12 prac.' }, answer: { en: 'Heracles', pl: 'Herkules' } },
                { value: VALUES[3], clue: { en: 'The goddess of wisdom.', pl: 'Bogini mądrości.' }, answer: { en: 'Athena', pl: 'Atena' } },
                { value: VALUES[4], clue: { en: 'The three-headed dog guarding the underworld.', pl: 'Trójgłowy pies strzegący podziemi.' }, answer: { en: 'Cerberus', pl: 'Cerber' } },
            ],
        },
        {
            title: { en: 'Art', pl: 'Sztuka' },
            clues: [
                { value: VALUES[0], clue: { en: 'The artist who painted the Mona Lisa.', pl: 'Artysta, który namalował Mona Lisę.' }, answer: { en: 'Da Vinci', pl: 'Da Vinci' } },
                { value: VALUES[1], clue: { en: 'The artist who cut off his own ear.', pl: 'Artysta, który odciął sobie ucho.' }, answer: { en: 'Van Gogh', pl: 'Van Gogh' } },
                { value: VALUES[2], clue: { en: 'The art movement associated with Claude Monet.', pl: 'Kierunek w sztuce kojarzony z Claudem Monetem.' }, answer: { en: 'Impressionism', pl: 'Impresjonizm' } },
                { value: VALUES[3], clue: { en: 'The ceiling painted by Michelangelo.', pl: 'Sufit namalowany przez Michała Anioła.' }, answer: { en: 'Sistine Chapel', pl: 'Kaplica Sykstyńska' } },
                { value: VALUES[4], clue: { en: 'The Spanish surrealist famous for melting clocks.', pl: 'Hiszpański surrealista znany z „miękkich zegarów”.' }, answer: { en: 'Dali', pl: 'Dali' } },
            ],
        },
        {
            title: { en: 'Animals', pl: 'Zwierzęta' },
            clues: [
                { value: VALUES[0], clue: { en: 'The tallest land animal.', pl: 'Najwyższe zwierzę lądowe.' }, answer: { en: 'Giraffe', pl: 'Żyrafa' } },
                { value: VALUES[1], clue: { en: 'The only mammal that can fly.', pl: 'Jedyny ssak potrafiący latać.' }, answer: { en: 'Bat', pl: 'Nietoperz' } },
                { value: VALUES[2], clue: { en: 'The largest mammal in the world.', pl: 'Największy ssak na świecie.' }, answer: { en: 'Blue Whale', pl: 'Płetwal błękitny' } },
                { value: VALUES[3], clue: { en: 'The animal known as the "King of the Jungle".', pl: 'Zwierzę nazywane „Królem Dżungli”.' }, answer: { en: 'Lion', pl: 'Lew' } },
                { value: VALUES[4], clue: { en: 'The number of legs a spider has.', pl: 'Liczba nóg pająka.' }, answer: { en: '8', pl: '8' } },
            ],
        },
        {
            title: { en: 'Food', pl: 'Jedzenie' },
            clues: [
                { value: VALUES[0], clue: { en: 'The main ingredient of bread.', pl: 'Główny składnik chleba.' }, answer: { en: 'Flour', pl: 'Mąka' } },
                { value: VALUES[1], clue: { en: 'The country where pizza was invented.', pl: 'Kraj, w którym wynaleziono pizzę.' }, answer: { en: 'Italy', pl: 'Włochy' } },
                { value: VALUES[2], clue: { en: 'The fruit used to make wine.', pl: 'Owoc używany do produkcji wina.' }, answer: { en: 'Grapes', pl: 'Winogrona' } },
                { value: VALUES[3], clue: { en: 'The source of maple syrup.', pl: 'Źródło syropu klonowego.' }, answer: { en: 'Maple Tree', pl: 'Klon' } },
                { value: VALUES[4], clue: { en: 'The most expensive spice in the world.', pl: 'Najdroższa przyprawa świata.' }, answer: { en: 'Saffron', pl: 'Szafran' } },
            ],
        },
        {
            title: { en: 'Space', pl: 'Kosmos' },
            clues: [
                { value: VALUES[0], clue: { en: 'The Red Planet.', pl: 'Czerwona Planeta.' }, answer: { en: 'Mars', pl: 'Mars' } },
                { value: VALUES[1], clue: { en: 'The largest planet in our solar system.', pl: 'Największa planeta w naszym układzie.' }, answer: { en: 'Jupiter', pl: 'Jowisz' } },
                { value: VALUES[2], clue: { en: 'The first person in space.', pl: 'Pierwszy człowiek w kosmosie.' }, answer: { en: 'Yuri Gagarin', pl: 'Jurij Gagarin' } },
                { value: VALUES[3], clue: { en: 'The natural satellite of Earth.', pl: 'Naturalny satelita Ziemi.' }, answer: { en: 'Moon', pl: 'Księżyc' } },
                { value: VALUES[4], clue: { en: 'The name of our galaxy.', pl: 'Nazwa naszej galaktyki.' }, answer: { en: 'Milky Way', pl: 'Droga Mleczna' } },
            ],
        },
        {
            title: { en: 'Human Body', pl: 'Ludzkie ciało' },
            clues: [
                { value: VALUES[0], clue: { en: 'The organ that pumps blood.', pl: 'Narząd pompujący krew.' }, answer: { en: 'Heart', pl: 'Serce' } },
                { value: VALUES[1], clue: { en: 'The largest organ of the body.', pl: 'Największy narząd ciała.' }, answer: { en: 'Skin', pl: 'Skóra' } },
                { value: VALUES[2], clue: { en: 'The number of bones in an adult.', pl: 'Liczba kości u dorosłego człowieka.' }, answer: { en: '206', pl: '206' } },
                { value: VALUES[3], clue: { en: 'The hard protective layer of teeth.', pl: 'Twarda ochronna warstwa zębów.' }, answer: { en: 'Enamel', pl: 'Szkliwo' } },
                { value: VALUES[4], clue: { en: 'The gas we breathe in to survive.', pl: 'Gaz, którym oddychamy, by żyć.' }, answer: { en: 'Oxygen', pl: 'Tlen' } },
            ],
        },
        {
            title: { en: 'Business', pl: 'Biznes' },
            clues: [
                { value: VALUES[0], clue: { en: 'The founder of Microsoft.', pl: 'Założyciel Microsoftu.' }, answer: { en: 'Bill Gates', pl: 'Bill Gates' } },
                { value: VALUES[1], clue: { en: 'The currency of the European Union.', pl: 'Waluta Unii Europejskiej.' }, answer: { en: 'Euro', pl: 'Euro' } },
                { value: VALUES[2], clue: { en: 'The largest retailer in the world.', pl: 'Największy detalista na świecie.' }, answer: { en: 'Walmart', pl: 'Walmart' } },
                { value: VALUES[3], clue: { en: 'The company behind the search engine Google.', pl: 'Firma stojąca za wyszukiwarką Google.' }, answer: { en: 'Alphabet', pl: 'Alphabet' } },
                { value: VALUES[4], clue: { en: 'The billionaire founder of Tesla.', pl: 'Miliarder, założyciel Tesli.' }, answer: { en: 'Elon Musk', pl: 'Elon Musk' } },
            ],
        },
        {
            title: { en: 'Physics', pl: 'Fizyka' },
            clues: [
                { value: VALUES[0], clue: { en: 'The force that keeps us on the ground.', pl: 'Siła, która trzyma nas na ziemi.' }, answer: { en: 'Gravity', pl: 'Grawitacja' } },
                { value: VALUES[1], clue: { en: 'The speed of light in vacuum.', pl: 'Prędkość światła w próżni.' }, answer: { en: '300,000 km/s', pl: '300 000 km/s' } },
                { value: VALUES[2], clue: { en: 'The unit of electrical resistance.', pl: 'Jednostka oporu elektrycznego.' }, answer: { en: 'Ohm', pl: 'Om' } },
                { value: VALUES[3], clue: { en: 'The scientist who discovered radioactivity.', pl: 'Uczona, która odkryła promieniotwórczość.' }, answer: { en: 'Marie Curie', pl: 'Skłodowska-Curie' } },
                { value: VALUES[4], clue: { en: 'The part of an atom with a negative charge.', pl: 'Część atomu o ładunku ujemnym.' }, answer: { en: 'Electron', pl: 'Elektron' } },
            ],
        },
        {
            title: { en: 'Computers', pl: 'Informatyka' },
            clues: [
                { value: VALUES[0], clue: { en: 'The language used for web pages.', pl: 'Język używany do tworzenia stron WWW.' }, answer: { en: 'HTML', pl: 'HTML' } },
                { value: VALUES[1], clue: { en: 'The number of bits in a byte.', pl: 'Liczba bitów w bajcie.' }, answer: { en: '8', pl: '8' } },
                { value: VALUES[2], clue: { en: 'The brain of the computer.', pl: 'Mózg komputera.' }, answer: { en: 'CPU', pl: 'Procesor' } },
                { value: VALUES[3], clue: { en: 'A storage device with no moving parts.', pl: 'Urządzenie pamięci masowej bez części ruchomych.' }, answer: { en: 'SSD', pl: 'SSD' } },
                { value: VALUES[4], clue: { en: 'The operating system created by Linus Torvalds.', pl: 'System operacyjny stworzony przez Linusa Torvaldsa.' }, answer: { en: 'Linux', pl: 'Linux' } },
            ],
        },
        {
            title: { en: 'Poland', pl: 'Polska' },
            clues: [
                { value: VALUES[0], clue: { en: 'The capital of Poland.', pl: 'Stolica Polski.' }, answer: { en: 'Warsaw', pl: 'Warszawa' } },
                { value: VALUES[1], clue: { en: 'The longest river in Poland.', pl: 'Najdłuższa rzeka w Polsce.' }, answer: { en: 'Vistula', pl: 'Wisła' } },
                { value: VALUES[2], clue: { en: 'The first capital of Poland.', pl: 'Pierwsza stolica Polski.' }, answer: { en: 'Gniezno', pl: 'Gniezno' } },
                { value: VALUES[3], clue: { en: 'The composer of famous polonaises.', pl: 'Kompozytor słynnych polonezów.' }, answer: { en: 'Chopin', pl: 'Szopen' } },
                { value: VALUES[4], clue: { en: 'The year Poland joined the EU.', pl: 'Rok wstąpienia Polski do UE.' }, answer: { en: '2004', pl: '2004' } },
            ],
        },
        {
            title: { en: 'Architecture', pl: 'Architektura' },
            clues: [
                { value: VALUES[0], clue: { en: 'The tower in Paris.', pl: 'Wieża w Paryżu.' }, answer: { en: 'Eiffel Tower', pl: 'Wieża Eiffla' } },
                { value: VALUES[1], clue: { en: 'The famous clock tower in London.', pl: 'Słynna wieża zegarowa w Londynie.' }, answer: { en: 'Big Ben', pl: 'Big Ben' } },
                { value: VALUES[2], clue: { en: 'The tomb built for Mumtaz Mahal.', pl: 'Grobowiec zbudowany dla Mumtaz Mahal.' }, answer: { en: 'Taj Mahal', pl: 'Tadź Mahal' } },
                { value: VALUES[3], clue: { en: 'The world\'s tallest building (Dubai).', pl: 'Najwyższy budynek świata (Dubaj).' }, answer: { en: 'Burj Khalifa', pl: 'Burdż Chalifa' } },
                { value: VALUES[4], clue: { en: 'The leaning tower city.', pl: 'Miasto z krzywą wieżą.' }, answer: { en: 'Pisa', pl: 'Piza' } },
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
