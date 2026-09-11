/**
 * COCKTAIL CONNECTIONS — CONTENT DATABASE
 * =========================================================================
 * ARCHITECTURAL CONTRACT:
 * - This file contains the complete puzzle catalogue and daily scheduling config.
 * - To add new puzzles: append new objects to the `puzzles` array below.
 * - DO NOT EDIT `index.html`, `style.css`, or `script.js` when adding puzzles.
 *
 * PUZZLE SCHEMA CONTRACT:
 * - id: String (unique, stable identifier)
 * - title: String (bar-inspired theme title)
 * - curriculumCategory: String (one of the 32 master curriculum areas)
 * - difficulty: String ("Beginner" | "Easy" | "Medium" | "Hard" | "Expert")
 * - categories: Array of 4 category objects:
 *     - name: String (uppercase connection title)
 *     - difficulty: String ("yellow" | "green" | "blue" | "purple")
 *     - items: Array of exactly 4 strings (all uppercase, single/short terms)
 *
 * DIFFICULTY ORDER & COLOR CONVENTIONS:
 * - yellow: Straightforward / Foundations (Level 1)
 * - green: Developing / Ingredients / Common Modifiers (Level 2)
 * - blue: Technical / Glassware / Production / History (Level 3-4)
 * - purple: Cocktail Lore, Wordplay, Homophones, Subtle Connections (Level 5)
 * =========================================================================
 */

window.COCKTAIL_PUZZLES_DATA = {
  config: {
    // Epoch Date anchor for Day 1.
    // Day 1 has 1 puzzle in Today and 0 in the Vault.
    epochDate: "2025-02-24",
    timeZone: "UTC"
  },

  puzzles: [
    // -----------------------------------------------------------------------
    // PUZZLE 1: FIRST CALL
    // Curriculum: Foundations, Citrus, Glassware, Cocktail Lore
    // -----------------------------------------------------------------------
    {
      id: "cocktail-conn-1",
      title: "First Call",
      curriculumCategory: "Level 1: Cocktail Families & Glassware",
      difficulty: "Easy",
      categories: [
        {
          name: "HISTORIC PRE-PROHIBITION COCKTAIL FAMILIES",
          difficulty: "yellow",
          items: ["DAISY", "FIX", "FLIP", "SMASH"]
        },
        {
          name: "CITRUS FRUITS COMMONLY EXPRESSED OR JUICED",
          difficulty: "green",
          items: ["BERGAMOT", "GRAPEFRUIT", "LEMON", "LIME"]
        },
        {
          name: "STEMMED COCKTAIL GLASSWARE",
          difficulty: "blue",
          items: ["COUPE", "FLUTE", "NICK & NORA", "SNIFTER"]
        },
        {
          name: "WORDS THAT PRECEDE 'SOUR' TO NAME A COCKTAIL",
          difficulty: "purple",
          items: ["BOSTON", "NEW YORK", "PISCO", "STONE"]
        }
      ]
    },

    // -----------------------------------------------------------------------
    // PUZZLE 2: AGAVE & APERITIVO
    // Curriculum: Aperitifs & Amari, Agave, Garnishes, Martini Variations
    // -----------------------------------------------------------------------
    {
      id: "cocktail-conn-2",
      title: "Agave & Aperitivo",
      curriculumCategory: "Level 2: Aperitifs, Amari & Core Spirits",
      difficulty: "Medium",
      categories: [
        {
          name: "ITALIAN RED BITTER APERITIFS",
          difficulty: "yellow",
          items: ["APEROL", "CAMPARI", "CYNAR", "SELECT"]
        },
        {
          name: "CLASSIC COCKTAIL GARNISHES",
          difficulty: "green",
          items: ["CASTELVETRANO OLIVE", "LEMON WHEEL", "MARASCHINO CHERRY", "PEARL ONION"]
        },
        {
          name: "AGAVE SPIRIT CLASSIFICATIONS",
          difficulty: "blue",
          items: ["AÑEJO", "BLANCO", "EXTRA AÑEJO", "REPOSADO"]
        },
        {
          name: "WORDS THAT CAN PRECEDE 'MARTINI'",
          difficulty: "purple",
          items: ["DIRTY", "DRY", "ESPRESSO", "FRENCH"]
        }
      ]
    },

    // -----------------------------------------------------------------------
    // PUZZLE 3: TIKI, BOTANICALS & ICE
    // Curriculum: Tiki Culture, Orange Modifiers, Gin Botanicals, Ice Architecture
    // -----------------------------------------------------------------------
    {
      id: "cocktail-conn-3",
      title: "Tropical Botanica",
      curriculumCategory: "Level 3: Ice, Dilution & Tiki Traditions",
      difficulty: "Medium",
      categories: [
        {
          name: "FAMOUS TIKI & TROPICAL COCKTAILS",
          difficulty: "yellow",
          items: ["JUNGLE BIRD", "MAI TAI", "PAINKILLER", "ZOMBIE"]
        },
        {
          name: "CLASSIC ORANGE LIQUEURS",
          difficulty: "green",
          items: ["BLUE CURAÇAO", "COINTREAU", "GRAND MARNIER", "TRIPLE SEC"]
        },
        {
          name: "ESSENTIAL GIN BOTANICALS",
          difficulty: "blue",
          items: ["ANGELICA ROOT", "CORIANDER SEED", "JUNIPER BERRY", "ORRIS ROOT"]
        },
        {
          name: "COCKTAIL ICE FORMATS & DESCRIPTIONS",
          difficulty: "purple",
          items: ["CLEAR", "CRUSHED", "LARGE ROCK", "PEBBLE"]
        }
      ]
    },

    // -----------------------------------------------------------------------
    // PUZZLE 4: BITTERS, HERBS & PROHIBITION
    // Curriculum: Bitters, Produce, Speakeasy Lore, Animal Cocktails
    // -----------------------------------------------------------------------
    {
      id: "cocktail-conn-4",
      title: "Speakeasy Botanical",
      curriculumCategory: "Level 4: Prohibition History & Bitters",
      difficulty: "Hard",
      categories: [
        {
          name: "HISTORIC BITTERS & DIGESTIF PRODUCERS",
          difficulty: "yellow",
          items: ["ANGOSTURA", "FEE BROTHERS", "PEYCHAUD'S", "UNDERBERG"]
        },
        {
          name: "FRESH HERBS AT THE SPEED RACK",
          difficulty: "green",
          items: ["BASIL", "MINT", "ROSEMARY", "SAGE"]
        },
        {
          name: "PROHIBITION-ERA CLASSIC COCKTAILS",
          difficulty: "blue",
          items: ["BEE'S KNEES", "LAST WORD", "MARY PICKFORD", "SCOFFLAW"]
        },
        {
          name: "CLASSIC DRINKS NAMED AFTER ANIMALS OR CREATURES",
          difficulty: "purple",
          items: ["BULL SHOT", "GRASSHOPPER", "GREYHOUND", "PINK SQUIRREL"]
        }
      ]
    },

    // -----------------------------------------------------------------------
    // PUZZLE 5: THE MASTER'S SPEC
    // Curriculum: Spirit Production, French Liqueurs, Bond Specs, Shaking Technique
    // -----------------------------------------------------------------------
    {
      id: "cocktail-conn-5",
      title: "The Master's Spec",
      curriculumCategory: "Level 5: Technique, Production & Lore",
      difficulty: "Expert",
      categories: [
        {
          name: "INGREDIENTS IN A CLASSIC VESPER MARTINI",
          difficulty: "yellow",
          items: ["GIN", "KINA LILLET", "LEMON PEEL", "VODKA"]
        },
        {
          name: "HERBAL OR BITTER FRENCH APERITIFS & LIQUEURS",
          difficulty: "green",
          items: ["BÉNÉDICTINE", "CHARTREUSE", "ST-GERMAIN", "SUZE"]
        },
        {
          name: "PRIMARY DISTILLATION & PRODUCTION STAGES",
          difficulty: "blue",
          items: ["AGING", "DISTILLATION", "FERMENTATION", "MACERATION"]
        },
        {
          name: "TYPES OF 'SHAKES' IN PROFESSIONAL BARTENDING",
          difficulty: "purple",
          items: ["DRY", "HARD", "REVERSE DRY", "WHIP"]
        }
      ]
    }
  ]
};