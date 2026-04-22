import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type EyeOffProps = {
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
  "id": "eye-off",
  "name": "eyeOff",
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
            "d": "M10.733 5.076 C15.520139 4.505508 20.101173 7.19362 21.938 11.651 C22.021341 11.875515 22.021341 12.122485 21.938 12.347 C21.570498 13.237995 21.08481 14.075505 20.494 14.837"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "path-2": {
          "id": "path-2",
          "path": {
            "d": "M14.084 14.158 C12.906863 15.294917 11.035746 15.278657 9.878544 14.121456 C8.721343 12.964254 8.705083 11.093137 9.842 9.916"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "path-3": {
          "id": "path-3",
          "path": {
            "d": "M17.479 17.499 C14.794909 19.088947 11.552508 19.434478 8.593631 18.445882 C5.634754 17.457287 3.251267 15.232081 2.062 12.348 C1.978659 12.123485 1.978659 11.876515 2.062 11.652 C2.948632 9.501855 4.508673 7.697247 6.508 6.509"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "path-4": {
          "id": "path-4",
          "path": {
            "d": "M2 2 L22 22"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
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
                "d": "M10.733 5.076 C15.520139 4.505508 20.101173 7.19362 21.938 11.651 C22.021341 11.875515 22.021341 12.122485 21.938 12.347 C21.570498 13.237995 21.08481 14.075505 20.494 14.837"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "path-2": {
              "id": "path-2",
              "path": {
                "d": "M14.084 14.158 C12.906863 15.294917 11.035746 15.278657 9.878544 14.121456 C8.721343 12.964254 8.705083 11.093137 9.842 9.916"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "path-3": {
              "id": "path-3",
              "path": {
                "d": "M17.479 17.499 C14.794909 19.088947 11.552508 19.434478 8.593631 18.445882 C5.634754 17.457287 3.251267 15.232081 2.062 12.348 C1.978659 12.123485 1.978659 11.876515 2.062 11.652 C2.948632 9.501855 4.508673 7.697247 6.508 6.509"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "path-4": {
              "id": "path-4",
              "path": {
                "d": "M2 2 L22 22"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
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
            "d": "M10.733 5.076 C15.520139 4.505508 20.101173 7.19362 21.938 11.651 C22.021341 11.875515 22.021341 12.122485 21.938 12.347 C21.570498 13.237995 21.08481 14.075505 20.494 14.837"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "path-2": {
          "id": "path-2",
          "path": {
            "d": "M14.084 14.158 C12.906863 15.294917 11.035746 15.278657 9.878544 14.121456 C8.721343 12.964254 8.705083 11.093137 9.842 9.916"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "path-3": {
          "id": "path-3",
          "path": {
            "d": "M17.479 17.499 C14.794909 19.088947 11.552508 19.434478 8.593631 18.445882 C5.634754 17.457287 3.251267 15.232081 2.062 12.348 C1.978659 12.123485 1.978659 11.876515 2.062 11.652 C2.948632 9.501855 4.508673 7.697247 6.508 6.509"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "path-4": {
          "id": "path-4",
          "path": {
            "d": "M2 2 L22 22"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
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
                "d": "M10.733 5.076 C15.520139 4.505508 20.101173 7.19362 21.938 11.651 C22.021341 11.875515 22.021341 12.122485 21.938 12.347 C21.570498 13.237995 21.08481 14.075505 20.494 14.837"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "path-2": {
              "id": "path-2",
              "path": {
                "d": "M14.084 14.158 C12.906863 15.294917 11.035746 15.278657 9.878544 14.121456 C8.721343 12.964254 8.705083 11.093137 9.842 9.916"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "path-3": {
              "id": "path-3",
              "path": {
                "d": "M17.479 17.499 C14.794909 19.088947 11.552508 19.434478 8.593631 18.445882 C5.634754 17.457287 3.251267 15.232081 2.062 12.348 C1.978659 12.123485 1.978659 11.876515 2.062 11.652 C2.948632 9.501855 4.508673 7.697247 6.508 6.509"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "path-4": {
              "id": "path-4",
              "path": {
                "d": "M2 2 L22 22"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
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
      "sourceIconId": "eye-off",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T04:21:06.144Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function EyeOff({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: EyeOffProps) {
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
