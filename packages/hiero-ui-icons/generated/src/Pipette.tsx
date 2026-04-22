import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type PipetteProps = {
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
  "id": "pipette",
  "name": "pipette",
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
            "d": "M12 9 L3.586 17.414 C3.210901 17.788985 3.000113 18.29761 3 18.828 L3 20.172 C2.999887 20.70239 2.789099 21.211015 2.414 21.586 C2.788985 21.210901 3.29761 21.000113 3.828 21 L5.172 21 C5.70239 20.999887 6.211015 20.789099 6.586 20.414 L15 12"
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
            "d": "M18 9 L18.4 9.4 C19.228427 10.228427 19.228427 11.571573 18.4 12.4 C17.571573 13.228427 16.228427 13.228427 15.4 12.4 L11.6 8.6 C10.771573 7.771573 10.771573 6.428427 11.6 5.6 C12.428427 4.771573 13.771573 4.771573 14.6 5.6 L15 6 L18.4 2.6 C18.935898 2.064102 19.716987 1.854809 20.449038 2.050962 C21.181089 2.247114 21.752886 2.818911 21.949038 3.550962 C22.145191 4.283013 21.935898 5.064102 21.4 5.6 Z"
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
            "d": "M2 22 L2.414 21.586"
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
                "d": "M12 9 L3.586 17.414 C3.210901 17.788985 3.000113 18.29761 3 18.828 L3 20.172 C2.999887 20.70239 2.789099 21.211015 2.414 21.586 C2.788985 21.210901 3.29761 21.000113 3.828 21 L5.172 21 C5.70239 20.999887 6.211015 20.789099 6.586 20.414 L15 12"
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
                "d": "M18 9 L18.4 9.4 C19.228427 10.228427 19.228427 11.571573 18.4 12.4 C17.571573 13.228427 16.228427 13.228427 15.4 12.4 L11.6 8.6 C10.771573 7.771573 10.771573 6.428427 11.6 5.6 C12.428427 4.771573 13.771573 4.771573 14.6 5.6 L15 6 L18.4 2.6 C18.935898 2.064102 19.716987 1.854809 20.449038 2.050962 C21.181089 2.247114 21.752886 2.818911 21.949038 3.550962 C22.145191 4.283013 21.935898 5.064102 21.4 5.6 Z"
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
                "d": "M2 22 L2.414 21.586"
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
            "d": "M12 9 L3.586 17.414 C3.210901 17.788985 3.000113 18.29761 3 18.828 L3 20.172 C2.999887 20.70239 2.789099 21.211015 2.414 21.586 C2.788985 21.210901 3.29761 21.000113 3.828 21 L5.172 21 C5.70239 20.999887 6.211015 20.789099 6.586 20.414 L15 12"
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
            "d": "M18 9 L18.4 9.4 C19.228427 10.228427 19.228427 11.571573 18.4 12.4 C17.571573 13.228427 16.228427 13.228427 15.4 12.4 L11.6 8.6 C10.771573 7.771573 10.771573 6.428427 11.6 5.6 C12.428427 4.771573 13.771573 4.771573 14.6 5.6 L15 6 L18.4 2.6 C18.935898 2.064102 19.716987 1.854809 20.449038 2.050962 C21.181089 2.247114 21.752886 2.818911 21.949038 3.550962 C22.145191 4.283013 21.935898 5.064102 21.4 5.6 Z"
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
            "d": "M2 22 L2.414 21.586"
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
                "d": "M12 9 L3.586 17.414 C3.210901 17.788985 3.000113 18.29761 3 18.828 L3 20.172 C2.999887 20.70239 2.789099 21.211015 2.414 21.586 C2.788985 21.210901 3.29761 21.000113 3.828 21 L5.172 21 C5.70239 20.999887 6.211015 20.789099 6.586 20.414 L15 12"
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
                "d": "M18 9 L18.4 9.4 C19.228427 10.228427 19.228427 11.571573 18.4 12.4 C17.571573 13.228427 16.228427 13.228427 15.4 12.4 L11.6 8.6 C10.771573 7.771573 10.771573 6.428427 11.6 5.6 C12.428427 4.771573 13.771573 4.771573 14.6 5.6 L15 6 L18.4 2.6 C18.935898 2.064102 19.716987 1.854809 20.449038 2.050962 C21.181089 2.247114 21.752886 2.818911 21.949038 3.550962 C22.145191 4.283013 21.935898 5.064102 21.4 5.6 Z"
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
                "d": "M2 22 L2.414 21.586"
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
      "sourceVersion": "0.577.0",
      "sourceIconId": "pipette",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:44:58.769Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Pipette({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: PipetteProps) {
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
