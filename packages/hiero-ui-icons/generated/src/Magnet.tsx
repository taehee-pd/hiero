import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type MagnetProps = {
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
  label?: string;
  reduceMotion?: boolean | 'system';
  variant?: "v-16" | "v-24" | "16" | "24" | number;
  effect?: never;
  animate?: boolean;
};

const iconData = {
  "id": "magnet",
  "name": "magnet",
  "variants": {
    "v-16": {
      "id": "v-16",
      "name": "16",
      "size": 16,
      "viewBox": [
        0,
        0,
        24,
        24
      ],
      "layers": {
        "path": {
          "id": "path",
          "path": {
            "d": "M12 15 L16 19"
          },
          "style": {
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round",
            "fill": {
              "mode": "currentColor"
            }
          }
        },
        "path-2": {
          "id": "path-2",
          "path": {
            "d": "M2.352 10.648 C1.881503 11.118567 1.881503 11.881433 2.352 12.352 L4.648 14.648 C5.118567 15.118497 5.881433 15.118497 6.352 14.648 L12.381 8.619 C13.209427 7.790573 14.552573 7.790573 15.381 8.619 C16.209427 9.447427 16.209427 10.790573 15.381 11.619 L9.352 17.648 C8.881503 18.118567 8.881503 18.881433 9.352 19.352 L11.648 21.648 C12.118567 22.118497 12.881433 22.118497 13.352 21.648 L19.717 15.281 C22.75429 12.243158 22.753842 7.31829 19.716 4.281 C16.678158 1.24371 11.75329 1.244158 8.716 4.282 Z"
          },
          "style": {
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round",
            "fill": {
              "mode": "currentColor"
            }
          }
        },
        "path-3": {
          "id": "path-3",
          "path": {
            "d": "M5 8 L9 12"
          },
          "style": {
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round",
            "fill": {
              "mode": "currentColor"
            }
          }
        }
      },
      "defaultType": "default",
      "types": {
        "default": {
          "id": "default",
          "layers": {
            "path": {
              "id": "path",
              "path": {
                "d": "M12 15 L16 19"
              },
              "style": {
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round",
                "fill": {
                  "mode": "currentColor"
                }
              }
            },
            "path-2": {
              "id": "path-2",
              "path": {
                "d": "M2.352 10.648 C1.881503 11.118567 1.881503 11.881433 2.352 12.352 L4.648 14.648 C5.118567 15.118497 5.881433 15.118497 6.352 14.648 L12.381 8.619 C13.209427 7.790573 14.552573 7.790573 15.381 8.619 C16.209427 9.447427 16.209427 10.790573 15.381 11.619 L9.352 17.648 C8.881503 18.118567 8.881503 18.881433 9.352 19.352 L11.648 21.648 C12.118567 22.118497 12.881433 22.118497 13.352 21.648 L19.717 15.281 C22.75429 12.243158 22.753842 7.31829 19.716 4.281 C16.678158 1.24371 11.75329 1.244158 8.716 4.282 Z"
              },
              "style": {
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round",
                "fill": {
                  "mode": "currentColor"
                }
              }
            },
            "path-3": {
              "id": "path-3",
              "path": {
                "d": "M5 8 L9 12"
              },
              "style": {
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round",
                "fill": {
                  "mode": "currentColor"
                }
              }
            }
          }
        }
      }
    },
    "v-24": {
      "id": "v-24",
      "name": "24",
      "size": 24,
      "viewBox": [
        0,
        0,
        24,
        24
      ],
      "layers": {
        "path": {
          "id": "path",
          "path": {
            "d": "M12 15 L16 19"
          },
          "style": {
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round",
            "fill": {
              "mode": "currentColor"
            }
          }
        },
        "path-2": {
          "id": "path-2",
          "path": {
            "d": "M2.352 10.648 C1.881503 11.118567 1.881503 11.881433 2.352 12.352 L4.648 14.648 C5.118567 15.118497 5.881433 15.118497 6.352 14.648 L12.381 8.619 C13.209427 7.790573 14.552573 7.790573 15.381 8.619 C16.209427 9.447427 16.209427 10.790573 15.381 11.619 L9.352 17.648 C8.881503 18.118567 8.881503 18.881433 9.352 19.352 L11.648 21.648 C12.118567 22.118497 12.881433 22.118497 13.352 21.648 L19.717 15.281 C22.75429 12.243158 22.753842 7.31829 19.716 4.281 C16.678158 1.24371 11.75329 1.244158 8.716 4.282 Z"
          },
          "style": {
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round",
            "fill": {
              "mode": "currentColor"
            }
          }
        },
        "path-3": {
          "id": "path-3",
          "path": {
            "d": "M5 8 L9 12"
          },
          "style": {
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round",
            "fill": {
              "mode": "currentColor"
            }
          }
        }
      },
      "defaultType": "default",
      "types": {
        "default": {
          "id": "default",
          "layers": {
            "path": {
              "id": "path",
              "path": {
                "d": "M12 15 L16 19"
              },
              "style": {
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round",
                "fill": {
                  "mode": "currentColor"
                }
              }
            },
            "path-2": {
              "id": "path-2",
              "path": {
                "d": "M2.352 10.648 C1.881503 11.118567 1.881503 11.881433 2.352 12.352 L4.648 14.648 C5.118567 15.118497 5.881433 15.118497 6.352 14.648 L12.381 8.619 C13.209427 7.790573 14.552573 7.790573 15.381 8.619 C16.209427 9.447427 16.209427 10.790573 15.381 11.619 L9.352 17.648 C8.881503 18.118567 8.881503 18.881433 9.352 19.352 L11.648 21.648 C12.118567 22.118497 12.881433 22.118497 13.352 21.648 L19.717 15.281 C22.75429 12.243158 22.753842 7.31829 19.716 4.281 C16.678158 1.24371 11.75329 1.244158 8.716 4.282 Z"
              },
              "style": {
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round",
                "fill": {
                  "mode": "currentColor"
                }
              }
            },
            "path-3": {
              "id": "path-3",
              "path": {
                "d": "M5 8 L9 12"
              },
              "style": {
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round",
                "fill": {
                  "mode": "currentColor"
                }
              }
            }
          }
        }
      }
    }
  },
  "meta": {
    "externalImport": {
      "adapterId": "lucide",
      "sourceLibrary": "lucide",
      "sourceVersion": "1.8.0",
      "sourceIconId": "magnet",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T04:21:06.205Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Magnet({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: MagnetProps) {
  return (
    <HieroIcon
      icon={typedIconData}
      size={size}
      color={color}
      className={className}
      style={style}
      label={label}
      reduceMotion={reduceMotion}
      variant={variant}
      animate={animate}
    />
  );
}
