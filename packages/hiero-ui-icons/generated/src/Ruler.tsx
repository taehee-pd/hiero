import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type RulerProps = {
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
  "id": "ruler",
  "name": "ruler",
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
            "d": "M21.3 15.3 C21.751891 15.750324 22.005893 16.362036 22.005893 17 C22.005893 17.637964 21.751891 18.249676 21.3 18.7 L18.7 21.3 C18.249676 21.751891 17.637964 22.005893 17 22.005893 C16.362036 22.005893 15.750324 21.751891 15.3 21.3 L2.7 8.7 C1.764326 7.759788 1.764326 6.240212 2.7 5.3 L5.3 2.7 C6.240212 1.764326 7.759788 1.764326 8.7 2.7 Z"
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
            "d": "M14.5 12.5 L16.5 10.5"
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
            "d": "M11.5 9.5 L13.5 7.5"
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
            "d": "M8.5 6.5 L10.5 4.5"
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
        "path-5": {
          "id": "path-5",
          "path": {
            "d": "M17.5 15.5 L19.5 13.5"
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
                "d": "M21.3 15.3 C21.751891 15.750324 22.005893 16.362036 22.005893 17 C22.005893 17.637964 21.751891 18.249676 21.3 18.7 L18.7 21.3 C18.249676 21.751891 17.637964 22.005893 17 22.005893 C16.362036 22.005893 15.750324 21.751891 15.3 21.3 L2.7 8.7 C1.764326 7.759788 1.764326 6.240212 2.7 5.3 L5.3 2.7 C6.240212 1.764326 7.759788 1.764326 8.7 2.7 Z"
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
                "d": "M14.5 12.5 L16.5 10.5"
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
                "d": "M11.5 9.5 L13.5 7.5"
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
                "d": "M8.5 6.5 L10.5 4.5"
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
            "path-5": {
              "id": "path-5",
              "path": {
                "d": "M17.5 15.5 L19.5 13.5"
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
            "d": "M21.3 15.3 C21.751891 15.750324 22.005893 16.362036 22.005893 17 C22.005893 17.637964 21.751891 18.249676 21.3 18.7 L18.7 21.3 C18.249676 21.751891 17.637964 22.005893 17 22.005893 C16.362036 22.005893 15.750324 21.751891 15.3 21.3 L2.7 8.7 C1.764326 7.759788 1.764326 6.240212 2.7 5.3 L5.3 2.7 C6.240212 1.764326 7.759788 1.764326 8.7 2.7 Z"
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
            "d": "M14.5 12.5 L16.5 10.5"
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
            "d": "M11.5 9.5 L13.5 7.5"
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
            "d": "M8.5 6.5 L10.5 4.5"
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
        "path-5": {
          "id": "path-5",
          "path": {
            "d": "M17.5 15.5 L19.5 13.5"
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
                "d": "M21.3 15.3 C21.751891 15.750324 22.005893 16.362036 22.005893 17 C22.005893 17.637964 21.751891 18.249676 21.3 18.7 L18.7 21.3 C18.249676 21.751891 17.637964 22.005893 17 22.005893 C16.362036 22.005893 15.750324 21.751891 15.3 21.3 L2.7 8.7 C1.764326 7.759788 1.764326 6.240212 2.7 5.3 L5.3 2.7 C6.240212 1.764326 7.759788 1.764326 8.7 2.7 Z"
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
                "d": "M14.5 12.5 L16.5 10.5"
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
                "d": "M11.5 9.5 L13.5 7.5"
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
                "d": "M8.5 6.5 L10.5 4.5"
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
            "path-5": {
              "id": "path-5",
              "path": {
                "d": "M17.5 15.5 L19.5 13.5"
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
      "sourceIconId": "ruler",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T04:21:06.198Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Ruler({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: RulerProps) {
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
