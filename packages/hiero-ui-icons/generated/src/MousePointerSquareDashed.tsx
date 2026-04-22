import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type MousePointerSquareDashedProps = {
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
  "id": "mouse-pointer-square-dashed",
  "name": "mousePointerSquareDashed",
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
            "d": "M12.034 12.681 C11.960317 12.496148 12.003752 12.285176 12.144464 12.144464 C12.285176 12.003752 12.496148 11.960317 12.681 12.034 L21.681 15.534 C21.878755 15.611272 22.006145 15.80501 21.998719 16.017196 C21.991294 16.229382 21.850673 16.41374 21.648 16.477 L18.204 17.545 C17.888524 17.642537 17.641537 17.889524 17.544 18.205 L16.477 21.648 C16.41374 21.850673 16.229382 21.991294 16.017196 21.998719 C15.80501 22.006145 15.611272 21.878755 15.534 21.681 Z"
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
            "d": "M5 3 C3.895431 3 3 3.895431 3 5"
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
            "d": "M19 3 C20.104569 3 21 3.895431 21 5"
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
            "d": "M5 21 C3.895431 21 3 20.104569 3 19"
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
            "d": "M9 3 L10 3"
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
        "path-6": {
          "id": "path-6",
          "path": {
            "d": "M9 21 L11 21"
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
        "path-7": {
          "id": "path-7",
          "path": {
            "d": "M14 3 L15 3"
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
        "path-8": {
          "id": "path-8",
          "path": {
            "d": "M3 9 L3 10"
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
        "path-9": {
          "id": "path-9",
          "path": {
            "d": "M21 9 L21 11"
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
        "path-10": {
          "id": "path-10",
          "path": {
            "d": "M3 14 L3 15"
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
                "d": "M12.034 12.681 C11.960317 12.496148 12.003752 12.285176 12.144464 12.144464 C12.285176 12.003752 12.496148 11.960317 12.681 12.034 L21.681 15.534 C21.878755 15.611272 22.006145 15.80501 21.998719 16.017196 C21.991294 16.229382 21.850673 16.41374 21.648 16.477 L18.204 17.545 C17.888524 17.642537 17.641537 17.889524 17.544 18.205 L16.477 21.648 C16.41374 21.850673 16.229382 21.991294 16.017196 21.998719 C15.80501 22.006145 15.611272 21.878755 15.534 21.681 Z"
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
                "d": "M5 3 C3.895431 3 3 3.895431 3 5"
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
                "d": "M19 3 C20.104569 3 21 3.895431 21 5"
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
                "d": "M5 21 C3.895431 21 3 20.104569 3 19"
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
                "d": "M9 3 L10 3"
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
            "path-6": {
              "id": "path-6",
              "path": {
                "d": "M9 21 L11 21"
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
            "path-7": {
              "id": "path-7",
              "path": {
                "d": "M14 3 L15 3"
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
            "path-8": {
              "id": "path-8",
              "path": {
                "d": "M3 9 L3 10"
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
            "path-9": {
              "id": "path-9",
              "path": {
                "d": "M21 9 L21 11"
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
            "path-10": {
              "id": "path-10",
              "path": {
                "d": "M3 14 L3 15"
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
            "d": "M12.034 12.681 C11.960317 12.496148 12.003752 12.285176 12.144464 12.144464 C12.285176 12.003752 12.496148 11.960317 12.681 12.034 L21.681 15.534 C21.878755 15.611272 22.006145 15.80501 21.998719 16.017196 C21.991294 16.229382 21.850673 16.41374 21.648 16.477 L18.204 17.545 C17.888524 17.642537 17.641537 17.889524 17.544 18.205 L16.477 21.648 C16.41374 21.850673 16.229382 21.991294 16.017196 21.998719 C15.80501 22.006145 15.611272 21.878755 15.534 21.681 Z"
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
            "d": "M5 3 C3.895431 3 3 3.895431 3 5"
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
            "d": "M19 3 C20.104569 3 21 3.895431 21 5"
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
            "d": "M5 21 C3.895431 21 3 20.104569 3 19"
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
            "d": "M9 3 L10 3"
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
        "path-6": {
          "id": "path-6",
          "path": {
            "d": "M9 21 L11 21"
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
        "path-7": {
          "id": "path-7",
          "path": {
            "d": "M14 3 L15 3"
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
        "path-8": {
          "id": "path-8",
          "path": {
            "d": "M3 9 L3 10"
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
        "path-9": {
          "id": "path-9",
          "path": {
            "d": "M21 9 L21 11"
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
        "path-10": {
          "id": "path-10",
          "path": {
            "d": "M3 14 L3 15"
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
                "d": "M12.034 12.681 C11.960317 12.496148 12.003752 12.285176 12.144464 12.144464 C12.285176 12.003752 12.496148 11.960317 12.681 12.034 L21.681 15.534 C21.878755 15.611272 22.006145 15.80501 21.998719 16.017196 C21.991294 16.229382 21.850673 16.41374 21.648 16.477 L18.204 17.545 C17.888524 17.642537 17.641537 17.889524 17.544 18.205 L16.477 21.648 C16.41374 21.850673 16.229382 21.991294 16.017196 21.998719 C15.80501 22.006145 15.611272 21.878755 15.534 21.681 Z"
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
                "d": "M5 3 C3.895431 3 3 3.895431 3 5"
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
                "d": "M19 3 C20.104569 3 21 3.895431 21 5"
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
                "d": "M5 21 C3.895431 21 3 20.104569 3 19"
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
                "d": "M9 3 L10 3"
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
            "path-6": {
              "id": "path-6",
              "path": {
                "d": "M9 21 L11 21"
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
            "path-7": {
              "id": "path-7",
              "path": {
                "d": "M14 3 L15 3"
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
            "path-8": {
              "id": "path-8",
              "path": {
                "d": "M3 9 L3 10"
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
            "path-9": {
              "id": "path-9",
              "path": {
                "d": "M21 9 L21 11"
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
            "path-10": {
              "id": "path-10",
              "path": {
                "d": "M3 14 L3 15"
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
      "sourceIconId": "mouse-pointer-square-dashed",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T04:21:06.207Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function MousePointerSquareDashed({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: MousePointerSquareDashedProps) {
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
