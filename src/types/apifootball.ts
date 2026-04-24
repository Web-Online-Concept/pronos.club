import { z } from "zod";

export const ApiFootballArrayResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    get: z.string(),
    parameters: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    errors: z.union([z.array(z.unknown()), z.record(z.string(), z.string())]).optional(),
    results: z.number(),
    paging: z
      .object({
        current: z.number(),
        total: z.number(),
      })
      .optional(),
    response: z.array(itemSchema),
  });

export const ApiFootballObjectResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    get: z.string(),
    parameters: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    errors: z.union([z.array(z.unknown()), z.record(z.string(), z.string())]).optional(),
    results: z.number(),
    paging: z
      .object({
        current: z.number(),
        total: z.number(),
      })
      .optional(),
    response: itemSchema,
  });

export const FixtureSchema = z.object({
  fixture: z.object({
    id: z.number(),
    referee: z.string().nullable(),
    timezone: z.string(),
    date: z.string(),
    timestamp: z.number(),
    periods: z.object({
      first: z.number().nullable(),
      second: z.number().nullable(),
    }),
    venue: z.object({
      id: z.number().nullable(),
      name: z.string().nullable(),
      city: z.string().nullable(),
    }),
    status: z.object({
      long: z.string(),
      short: z.string(),
      elapsed: z.number().nullable(),
      extra: z.number().nullable(),
    }),
  }),
  league: z.object({
    id: z.number(),
    name: z.string(),
    country: z.string(),
    logo: z.string().nullable(),
    flag: z.string().nullable(),
    season: z.number(),
    round: z.string(),
  }),
  teams: z.object({
    home: z.object({
      id: z.number(),
      name: z.string(),
      logo: z.string().nullable(),
      winner: z.boolean().nullable(),
    }),
    away: z.object({
      id: z.number(),
      name: z.string(),
      logo: z.string().nullable(),
      winner: z.boolean().nullable(),
    }),
  }),
  goals: z.object({
    home: z.number().nullable(),
    away: z.number().nullable(),
  }),
  score: z.object({
    halftime: z.object({
      home: z.number().nullable(),
      away: z.number().nullable(),
    }),
    fulltime: z.object({
      home: z.number().nullable(),
      away: z.number().nullable(),
    }),
    extratime: z.object({
      home: z.number().nullable(),
      away: z.number().nullable(),
    }),
    penalty: z.object({
      home: z.number().nullable(),
      away: z.number().nullable(),
    }),
  }),
});

export type Fixture = z.infer<typeof FixtureSchema>;

export const OddsSchema = z.object({
  league: z.object({
    id: z.number(),
    name: z.string(),
    country: z.string(),
    logo: z.string().nullable(),
    flag: z.string().nullable(),
    season: z.number(),
  }),
  fixture: z.object({
    id: z.number(),
    timezone: z.string(),
    date: z.string(),
    timestamp: z.number(),
  }),
  update: z.string(),
  bookmakers: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      bets: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          values: z.array(
            z.object({
              value: z.string(),
              odd: z.string(),
            })
          ),
        })
      ),
    })
  ),
});

export type Odds = z.infer<typeof OddsSchema>;

export const TeamStatisticsSchema = z
  .object({
    league: z.object({
      id: z.number(),
      name: z.string(),
      country: z.string(),
      logo: z.string().nullable(),
      flag: z.string().nullable(),
      season: z.number(),
    }),
    team: z.object({
      id: z.number(),
      name: z.string(),
      logo: z.string().nullable(),
    }),
    form: z.string().nullable(),
    fixtures: z.object({
      played: z.object({
        home: z.number(),
        away: z.number(),
        total: z.number(),
      }),
      wins: z.object({
        home: z.number(),
        away: z.number(),
        total: z.number(),
      }),
      draws: z.object({
        home: z.number(),
        away: z.number(),
        total: z.number(),
      }),
      loses: z.object({
        home: z.number(),
        away: z.number(),
        total: z.number(),
      }),
    }),
    goals: z.object({
      for: z.object({
        total: z.object({
          home: z.number(),
          away: z.number(),
          total: z.number(),
        }),
        average: z.object({
          home: z.string(),
          away: z.string(),
          total: z.string(),
        }),
      }),
      against: z.object({
        total: z.object({
          home: z.number(),
          away: z.number(),
          total: z.number(),
        }),
        average: z.object({
          home: z.string(),
          away: z.string(),
          total: z.string(),
        }),
      }),
    }),
    clean_sheet: z.object({
      home: z.number(),
      away: z.number(),
      total: z.number(),
    }),
    failed_to_score: z.object({
      home: z.number(),
      away: z.number(),
      total: z.number(),
    }),
  })
  .passthrough();

export type TeamStatistics = z.infer<typeof TeamStatisticsSchema>;

export const LineupSchema = z.object({
  team: z.object({
    id: z.number(),
    name: z.string(),
    logo: z.string().nullable(),
    colors: z.unknown().nullable(),
  }),
  coach: z.object({
    id: z.number().nullable(),
    name: z.string().nullable(),
    photo: z.string().nullable(),
  }),
  formation: z.string().nullable(),
  startXI: z.array(
    z.object({
      player: z.object({
        id: z.number().nullable(),
        name: z.string(),
        number: z.number().nullable(),
        pos: z.string().nullable(),
        grid: z.string().nullable(),
      }),
    })
  ),
  substitutes: z.array(
    z.object({
      player: z.object({
        id: z.number().nullable(),
        name: z.string(),
        number: z.number().nullable(),
        pos: z.string().nullable(),
        grid: z.string().nullable(),
      }),
    })
  ),
});

export type Lineup = z.infer<typeof LineupSchema>;

export const InjurySchema = z.object({
  player: z.object({
    id: z.number(),
    name: z.string(),
    photo: z.string().nullable(),
    type: z.string().nullable(),
    reason: z.string().nullable(),
  }),
  team: z.object({
    id: z.number(),
    name: z.string(),
    logo: z.string().nullable(),
  }),
  fixture: z.object({
    id: z.number(),
    timezone: z.string(),
    date: z.string(),
    timestamp: z.number(),
  }),
  league: z.object({
    id: z.number(),
    season: z.number(),
    name: z.string(),
    country: z.string(),
    logo: z.string().nullable(),
    flag: z.string().nullable(),
  }),
});

export type Injury = z.infer<typeof InjurySchema>;

export const PredictionSchema = z.object({
  predictions: z.object({
    winner: z.object({
      id: z.number().nullable(),
      name: z.string().nullable(),
      comment: z.string().nullable(),
    }),
    win_or_draw: z.boolean().nullable(),
    under_over: z.string().nullable(),
    goals: z.object({
      home: z.string().nullable(),
      away: z.string().nullable(),
    }),
    advice: z.string().nullable(),
    percent: z.object({
      home: z.string(),
      draw: z.string(),
      away: z.string(),
    }),
  }),
  league: z.object({
    id: z.number(),
    name: z.string(),
    country: z.string(),
    logo: z.string().nullable(),
    flag: z.string().nullable(),
    season: z.number(),
  }),
  teams: z.object({
    home: z.object({
      id: z.number(),
      name: z.string(),
      logo: z.string().nullable(),
      last_5: z.unknown().optional(),
      league: z.unknown().optional(),
    }),
    away: z.object({
      id: z.number(),
      name: z.string(),
      logo: z.string().nullable(),
      last_5: z.unknown().optional(),
      league: z.unknown().optional(),
    }),
  }),
  comparison: z.unknown().optional(),
  h2h: z.array(FixtureSchema).optional(),
});

export type Prediction = z.infer<typeof PredictionSchema>;

export const MAJOR_LEAGUE_IDS = {
  PREMIER_LEAGUE: 39,
  LA_LIGA: 140,
  SERIE_A: 135,
  BUNDESLIGA: 78,
  LIGUE_1: 61,
  CHAMPIONS_LEAGUE: 2,
  EUROPA_LEAGUE: 3,
  CONFERENCE_LEAGUE: 848,
} as const;

export const MAJOR_LEAGUE_LIST = Object.values(MAJOR_LEAGUE_IDS);

export type AggregatedMatchData = {
  fixtureId: number;
  fixture: Fixture;
  odds: Odds[] | null;
  homeStats: TeamStatistics | null;
  awayStats: TeamStatistics | null;
  lineups: Lineup[] | null;
  injuries: Injury[] | null;
  h2h: Fixture[] | null;
  predictions: Prediction | null;
  aggregatedAt: string;
  dataCompleteness: {
    hasOdds: boolean;
    hasHomeStats: boolean;
    hasAwayStats: boolean;
    hasLineups: boolean;
    hasInjuries: boolean;
    hasH2H: boolean;
    hasPredictions: boolean;
    score: number;
  };
};