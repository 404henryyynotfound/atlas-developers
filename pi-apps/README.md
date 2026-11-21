# Pi-Apps entries

These folders are ready-made [Pi-Apps](https://pi-apps.io/) app definitions for
64-bit ARM Raspberry Pi systems (Raspberry Pi OS 64-bit, Ubuntu arm64).

| Folder | Installs |
| --- | --- |
| `Atlas Suite/` | The `atlas-suite` desktop app from the `suite-v1.0.0` GitHub Release |
| `Atlas Developers/` | Both the `atlas` CLI and the Atlas Developers GUI from the `v1.0.4` GitHub Release |

Each installer downloads the official arm64 `.deb`, verifies its published
SHA-256 checksum, and installs it through Pi-Apps' `install_packages` helper.
The matching `uninstall` uses `purge_packages`, so removing an app never deletes
your local project data.

## Try it without waiting for official inclusion

1. Install Pi-Apps: <https://pi-apps.io/install/>
2. Open **Pi-Apps Settings → Import app**.
3. Paste the HTTPS URL of an import zip (see below), or a folder path, or a
   Pi-Apps pull-request URL.
4. The app appears in the **Imported** category and can be installed normally.

Import zips are attached to the releases. If you have this repository checked
out, you can also create one yourself:

```bash
cd pi-apps
zip -r Atlas-Suite.zip "Atlas Suite"
zip -r Atlas-Developers.zip "Atlas Developers"
```

Then import `Atlas-Suite.zip` or `Atlas-Developers.zip` through the Pi-Apps GUI.

## Official submission

To propose these for the official Pi-Apps repository:

1. Fork <https://github.com/Botspot/pi-apps>.
2. Copy each app folder into `apps/` in the fork.
3. Add category lines to `etc/categories`, for example:

   ```
   Atlas Suite|Office
   Atlas Developers|Programming
   ```

4. Ensure install/uninstall scripts are executable (`chmod 775`).
5. Run `shellcheck` and the `test_build.yml` workflow in the fork as described
   in [Pi-Apps CONTRIBUTING.md](https://github.com/Botspot/pi-apps/blob/master/CONTRIBUTING.md).
6. Open a pull request against `master` and link the CI run.

Both entries are `install-64` only. Pi-Apps accepts ARM64-only apps as of 2026.
