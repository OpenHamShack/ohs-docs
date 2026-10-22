# Packaging and boot facts (researched 09/10/2026, read-only)

Recipes marked [unverified] were not run when written; whoever runs one first
corrects this file.

## ISO (today vs needed)
- `Classic's archived appliance/mkiso.sh` is **UEFI only**: grub-mkstandalone BOOTX64.EFI,
  efiboot.img as EFI El Torito + appended GPT ESP, no BIOS entry, no MBR code.
  Live ISO = squashfs + live-boot, disk image `openhamshack/openhamshack.img.zst` beside it.
- `mkimage.sh`: debootstrap minbase, grub-efi-amd64 only, GPT ESP 256M + ext4,
  no bios_grub partition. `installer/installer.py` dd's the zst image + efibootmgr.
  It is a touch UI (sway + chromium); CI needs an unattended mode.
- For BIOS: installed image needs a 1 MiB EF02 bios_grub partition + grub-pc-bin +
  `grub-install --target=i386-pc` on the whole device (as well as EFI).
  **Correction (verified 09/10/2026):** `-isohybrid-mbr` below is for isolinux; with GRUB use
  `--grub2-mbr /usr/lib/grub/i386-pc/boot_hybrid.img -partition_offset 16 --mbr-force-bootable`.
  The working command is `~/openhamshack-os/image/mkiso.sh`.
  Live ISO needs `grub-mkimage -O i386-pc-eltorito ... -p /boot/grub biosdisk iso9660
  part_msdos part_gpt normal configfile search linux echo test`, i386-pc modules
  under iso/boot/grub/i386-pc/, and xorriso [unverified]:
  ```
  xorriso -as mkisofs -iso-level 3 -full-iso9660-filenames -joliet -joliet-long -rational-rock -volid OHS \
    -isohybrid-mbr /usr/lib/grub/i386-pc/boot_hybrid.img \
    -b boot/grub/bios.img -no-emul-boot -boot-load-size 4 -boot-info-table --grub2-boot-info \
    -eltorito-alt-boot -e --interval:appended_partition_2:all:: -no-emul-boot \
    -appended_part_as_gpt -append_partition 2 C12A7328-F81F-11D2-BA4B-00A0C93EC93B efiboot.img \
    -partition_cyl_align off -output OUT iso/
  ```
  Verify: `xorriso -indev X -report_el_torito plain` (BIOS 0x00 + UEFI 0xEF entries),
  `-report_system_area plain` (MBR bootable + GPT ESP).
- ohs-dev has debootstrap, grub-efi-amd64-bin, grub-pc-bin, ovmf
  (`/usr/share/OVMF/OVMF_CODE_4M.fd`, `OVMF_VARS_4M.fd`), qemu, xorriso, /dev/kvm,
  passwordless sudo. Missing: squashfs-tools, mtools, dosfstools(?), mmdebstrap.
- QEMU: UEFI = q35 + two pflash drives; BIOS = default SeaBIOS (`-machine pc`).
  USB-stick mode: `-drive file=X.iso,format=raw,if=none,id=u -device usb-storage,drive=u`.
  Run in ~/build, never /tmp. Ventoy: `Ventoy2Disk.sh -i /dev/loopN` on a raw
  image, copy ISO to its exFAT, boot in QEMU [unverified].

## Desktop form for web-UI apps
- Recommended: **pywebview** pointed at our own server on `127.0.0.1:<random>`
  with a per-launch token (`secrets.token_urlsafe`), `private_mode=True`.
  Fallback `webbrowser.open(url)` when pywebview/backend/WebView2 is missing.
  Linux deb deps: python3-gi gir1.2-webkit2-4.1 gir1.2-gtk-3.0. Win11 has
  WebView2; clean/LTSC Win10 may not. Don't ship the Qt backend (QtWebEngine is
  100+ MB).

## Existing pipelines (reuse them)
- **openhamshack-nb** (also HAM): `tools/build-deb.sh [nb|ham]` (dpkg-deb);
  `tools/build-windows.ps1 -App nb|ham` on Windows (NuGet Python, PyInstaller
  spec in packaging/windows, Inno Setup; `-NoSign` for beta);
  `tools/build-macos.sh --app nb|ham` on the Mac mini (PyInstaller .app/.dmg,
  ad-hoc codesign); `release.sh` insists on Authenticode by 360 Technology for
  Windows, so it must be relaxed for the unsigned beta. Self-update:
  `update-feed.py`, Ed25519 manifest.
- **openhamshack-atv**: build-deb.sh, build-windows.ps1 (+ Inno); no macOS.
- **openhamshack-datv**: build-windows.ps1, helpers cross-built on Linux
  (`build-helpers-windows.sh`, `packaging/helpers/build-in-container.sh`);
  Linux deb location unclear; no macOS.
- **openhamshack-teletext**: build-deb.sh only.
- Nothing builds AppImage anywhere yet (new work: python-appimage or
  linuxdeploy+appimagetool, built in a bookworm container for glibc).
- **ohsdigi**: PyO3 0.29 abi3-py311 cdylib (not maturin);
  `tools/build-ohsdigi.sh` builds linux-amd64/arm64 + windows-amd64 in podman
  (rust/build.Containerfile, bookworm); macOS natively on the Mac mini. No
  wheels yet.

## Hosts
- Windows desktop: `ssh 360admin@windows-pc` (tailnet), elevated, PS 5.1.
  ohs-dev's key is NOT authorised there: run Windows builds through shack (`ssh shack "ssh 360admin@windows-pc ..."`).
- Mac mini: `ssh mac`, no brew/sudo, big files on /Volumes/OpenHamShackBuild.
- Android toolchain only on shack (`~/android-toolchain`, jdk17, gradle, sdk,
  AVDs ohsr, ohsr-tv). Build APKs there over ssh.

## macOS signing and notarisation (09/10/2026, from the Mobile Apps session)
- Mac mini has "Developer ID Application: Brian Henderson (GTVYVL6ZY7)" in
  `~/Library/Keychains/ohs-signing.keychain-db`. Unlock over SSH with
  `security unlock-keychain -p "$(cat ~/.config/ohs-signing/keychain-pass)" ~/Library/Keychains/ohs-signing.keychain-db`
  (never print that file), then
  `codesign --force --options runtime --timestamp --keychain ~/Library/Keychains/ohs-signing.keychain-db -s "Developer ID Application: Brian Henderson (GTVYVL6ZY7)" <path>`.
- Notarise: `xcrun notarytool submit <zip|dmg|pkg> --keychain-profile ohs-notary --keychain ~/Library/Keychains/ohs-signing.keychain-db --wait`,
  then `xcrun stapler staple <file>`. API key "OpenHamShack builds" (Key ID
  2XZ5CG4DQT); the .p8 and keychain password never leave the Mac.
- **Beta: macOS .app/.dmg are signed AND notarised.** Windows/Linux stay
  unsigned (download page documents the SmartScreen / chmod steps).

## Remote app ids (09/10/2026)
- OpenHamShack Remote's permanent id is **com.openhamshack.remote** for iOS/tvOS
  bundle id (`ios/tools/genproject.py` BUNDLE_ID) and Android applicationId
  (was com.openhamshack.remote). Switch in the M4 Remote work;
  existing test installs become a separate app (fine: test devices only).
  App Store Connect record "OpenHamShack Remote" (iOS + tvOS) is being made by
  Brian; TestFlight once he confirms it exists.

## TestFlight (09/10/2026)
- App ID com.openhamshack.remote registered; App Store Connect record
  "OpenHamShack Remote" (iOS + tvOS, en-GB, SKU ohs-remote) exists.
- Archive on the Mac mini, team GTVYVL6ZY7, automatic signing via the API key so
  Xcode makes the Apple Distribution cert + profiles:
  `-allowProvisioningUpdates -authenticationKeyPath ~/.config/ohs-signing/AuthKey_2XZ5CG4DQT.p8 -authenticationKeyID 2XZ5CG4DQT -authenticationKeyIssuerID 984f7b89-9bf7-456c-aa70-2f6d4c36ef5c`
  (Developer ID is only for macOS apps outside the store). Upload with
  `xcrun altool` API-key auth or Transporter; internal TestFlight group with
  Brian as tester.
- **Never submit for App Store review** (EU trader status undecided; product
  page empty on purpose).

## Build-host traps found by the ISO build (09/10/2026)
- Caddy's cloudsmith apt repo answers "402 Payment Required": install Caddy
  2.11 from trixie-backports before Dock360's install.sh (it then skips the repo).
- Never bind-mount the host's /dev into a build chroot: a package script
  re-owned ohs-dev's /dev/kvm and broke every QEMU run (fix: private /dev;
  `sudo systemctl restart systemd-udevd` restores it). ~/openhamshack's mkimage.sh
  still has the pattern.
