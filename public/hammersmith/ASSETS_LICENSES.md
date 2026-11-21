# Third-party assets and code

Everything in `assets/` and `vendor/` that was not written for this project, with its source and licence.
Raw downloads live in `assets-src/` (about 1.5 GB, not needed at runtime, safe to delete or keep out of version
control); `tools/convert.html` turns them into the files under `assets/` (see `tools/README.md`).

## Characters: Microsoft Rocketbox Avatar Library

- Source: https://github.com/microsoft/Microsoft-Rocketbox (branch `master`, downloaded 14 Nov 2026)
- Licence: MIT, Copyright (c) 2020 Microsoft. Full text: https://github.com/microsoft/Microsoft-Rocketbox/blob/master/LICENSE.md
- Changes: each avatar converted from FBX to one GLB mesh (vertices indexed, the three source materials merged
  into one by moving their UVs into an atlas, embedded animation removed); the body, head and hair colour
  textures (2048 px TGA) combined into one 2048 x 1024 WebP atlas. Normal and specular maps are not used.

Each `assets/people/<id>.glb` + `<id>.webp` comes from the Rocketbox folder shown.

| id | Rocketbox source | id | Rocketbox source |
| --- | --- | --- | --- |
| `f02` | `Avatars/Adults/Female_Adult_02` | `m02` | `Avatars/Adults/Male_Adult_02` |
| `f04` | `Avatars/Adults/Female_Adult_04` | `m03` | `Avatars/Adults/Male_Adult_03` |
| `f06` | `Avatars/Adults/Female_Adult_06` | `m04` | `Avatars/Adults/Male_Adult_04` |
| `f07` | `Avatars/Adults/Female_Adult_07` | `m06` | `Avatars/Adults/Male_Adult_06` |
| `f08` | `Avatars/Adults/Female_Adult_08` | `m07` | `Avatars/Adults/Male_Adult_07` |
| `f09` | `Avatars/Adults/Female_Adult_09` | `m08` | `Avatars/Adults/Male_Adult_08` |
| `f10` | `Avatars/Adults/Female_Adult_10` | `m10` | `Avatars/Adults/Male_Adult_10` |
| `f11` | `Avatars/Adults/Female_Adult_11` | `m12` | `Avatars/Adults/Male_Adult_12` |
| `f13` | `Avatars/Adults/Female_Adult_13` | `m13` | `Avatars/Adults/Male_Adult_13` |
| `f14` | `Avatars/Adults/Female_Adult_14` | `m14` | `Avatars/Adults/Male_Adult_14` |
| `f15` | `Avatars/Adults/Female_Adult_15` | `m17` | `Avatars/Adults/Male_Adult_17` |
| `f17` | `Avatars/Adults/Female_Adult_17` | `m18` | `Avatars/Adults/Male_Adult_18` |
| `bf02` | `Avatars/Professions/Business_Female_02` | `m20` | `Avatars/Adults/Male_Adult_20` |
| `cf01` | `Avatars/Professions/Construction_Female_01` | `bm02` | `Avatars/Professions/Business_Male_02` |
| `cm07` | `Avatars/Professions/Construction_Male_07` | `bm05` | `Avatars/Professions/Business_Male_05` |
| | | `sm01` | `Avatars/Professions/Security_Male_01` |

`assets/people/cast.json` (the list of ids, sex and source height) and `assets/people/hands.json` (a relaxed
finger pose taken from the first frame of `f_idle_neutral_01`) are derived from the same library.

## Animation clips: Microsoft Rocketbox Avatar Library

- Source and licence: as above (MIT). Files from `Assets/Animations/all_animations_max_motextr_xy/` (walks) and
  `…_static/` (everything else), each `<name>.max.fbx`.
- Changes: converted to JSON keyframe clips (`assets/people/clips/<name>.json`) holding the rotations of the 23
  body bones plus the root position; finger, toe and face tracks dropped; forward travel removed from the walks
  and stored as a speed; non-walk clips thinned to 15 frames a second.

Each of these exists as `f_<name>` and `m_<name>`:
`walk_neutral_01`, `walk_slow_01`, `walk_stroll_01`, `walk_fast_01`, `idle_neutral_01`, `idle_neutral_02`,
`idle_look_around_01`, `cell_phone_textmessage`, `gestic_talk_neutral_01`, `wave_01`, `drink_idle`,
`drink_drinking`, `work_mid`, `sit_chair_idle_neutral_01`, `sit_table_idle_neutral_01`.
Also `f_hold_bag_idle_01` and `m_hold_bag_idle`.

## Code: three.js

- Source: https://github.com/mrdoob/three.js, release r186
- Licence: MIT, Copyright (c) 2010-2026 three.js authors (`vendor/THREE-LICENSE`)
- `vendor/three.module.js`, `vendor/three.core.js`: the library.
- `vendor/three-addons/` (from `examples/jsm/`, unmodified): `loaders/GLTFLoader.js`, `utils/BufferGeometryUtils.js`,
  `utils/SkeletonUtils.js` are used by the scene; `loaders/FBXLoader.js`, `loaders/TGALoader.js`,
  `exporters/GLTFExporter.js`, `curves/NURBSCurve.js`, `curves/NURBSUtils.js` are used only by `tools/convert.html`.
- `vendor/three-addons/libs/fflate.module.js`: fflate, MIT, Copyright (c) 2020 Arjun Barrett
  (https://github.com/101arrowz/fflate), bundled with three.js and used by FBXLoader.

## Brand names

The carrier bags carried by some shoppers are lettered "TESCO" and "PRIMARK" in plain type drawn by the scene.
No logo artwork from either company is included.
