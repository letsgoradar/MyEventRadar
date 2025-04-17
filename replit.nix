{pkgs}: {
  deps = [
    pkgs.jq
    pkgs.pkg-config
    pkgs.psmisc
    pkgs.lsof
    pkgs.postgresql
  ];
}
