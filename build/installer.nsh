; Do not allow the installer to target any workspace, source tree or arbitrary directory.
!macro customInit
  ; NSIS GetFullPathName can return an empty string for a nonexistent path.
  ; Normalize lexically using Win32 (also accepts a not-yet-created directory).
  ; Fail closed if either path cannot be normalized. Never redirect arbitrary /D targets.
  SetShellVarContext current
  StrCmp "$LOCALAPPDATA" "" wset_path_error
  StrCmp "$INSTDIR" "" wset_path_error
  System::Call 'kernel32::GetFullPathNameW(w "$LOCALAPPDATA\Programs\wset-editor\.", i ${NSIS_MAX_STRLEN}, w .r1, p 0) i .r0'
  StrCmp $0 0 wset_path_error
  IntCmp $0 ${NSIS_MAX_STRLEN} wset_path_error 0 wset_path_error
  StrCmp $1 "" wset_path_error
  System::Call 'kernel32::GetFullPathNameW(w "$INSTDIR\.", i ${NSIS_MAX_STRLEN}, w .r3, p 0) i .r0'
  StrCmp $0 0 wset_path_error
  IntCmp $0 ${NSIS_MAX_STRLEN} wset_path_error 0 wset_path_error
  StrCmp $3 "" wset_path_error
  StrCmp $1 $3 wset_check_dir
  ; Accept an existing installation in the formerly documented WSET directory,
  ; but only if it has our owner marker. Never redirect a registered install.
  System::Call 'kernel32::GetFullPathNameW(w "$LOCALAPPDATA\Programs\WSET\.", i ${NSIS_MAX_STRLEN}, w .r6, p 0) i .r0'
  StrCmp $0 0 wset_path_error
  IntCmp $0 ${NSIS_MAX_STRLEN} wset_path_error 0 wset_path_error
  StrCmp $6 "" wset_path_error
  StrCmp $6 $3 0 wset_path_mismatch
  IfFileExists "$3\resources\wset-install-owner.txt" wset_check_dir wset_path_mismatch
  wset_path_mismatch:
  MessageBox MB_ICONSTOP "WSET kan bare installeres i sin egen programmappe.$\r$\n$\r$\nForventet: $1$\r$\nValgt: $3$\r$\n$\r$\nIngen prosjektfiler overskrives av denne installasjonen." /SD IDOK
  SetErrorLevel 2
  Quit
  wset_path_error:
  MessageBox MB_ICONSTOP "Kunne ikke kontrollere installasjonsmappen.$\r$\n$\r$\nForventet: $LOCALAPPDATA\Programs\wset-editor$\r$\nValgt: $INSTDIR$\r$\n$\r$\nInstallasjonen er stoppet." /SD IDOK
  SetErrorLevel 2
  Quit
  wset_check_dir:
  StrCpy $INSTDIR $3
  ; Refuse a junction at the installation directory or Programs directory.
  System::Call 'kernel32::GetFileAttributesW(w "$LOCALAPPDATA\Programs") i .r0'
  StrCmp $0 -1 wset_check_target
  IntOp $0 $0 & 0x400
  IntCmp $0 0 wset_check_target wset_unsafe wset_unsafe
  wset_check_target:
  System::Call 'kernel32::GetFileAttributesW(w "$INSTDIR") i .r0'
  StrCmp $0 -1 wset_safe
  IntOp $0 $0 & 0x400
  IntCmp $0 0 wset_check_workspace wset_unsafe wset_unsafe
  wset_check_workspace:
  IfFileExists "$INSTDIR\Settings\*.*" wset_unsafe
  IfFileExists "$INSTDIR\System\*.*" wset_unsafe
  IfFileExists "$INSTDIR\Projects\*.*" wset_unsafe
  IfFileExists "$INSTDIR\Templates\*.*" wset_unsafe
  IfFileExists "$INSTDIR\Modules\*.*" wset_unsafe
  IfFileExists "$INSTDIR\Backups\*.*" wset_unsafe
  IfFileExists "$INSTDIR\Archive\*.*" wset_unsafe
  IfFileExists "$INSTDIR\Exports\*.*" wset_unsafe
  IfFileExists "$INSTDIR\resources\wset-install-owner.txt" wset_safe
  ClearErrors
  FindFirst $4 $5 "$INSTDIR\*.*"
  IfErrors wset_safe
  wset_scan:
  StrCmp $5 "." wset_next
  StrCmp $5 ".." wset_next
  FindClose $4
  Goto wset_unsafe
  wset_next:
  ClearErrors
  FindNext $4 $5
  IfErrors wset_empty
  Goto wset_scan
  wset_empty:
  FindClose $4
  Goto wset_safe
  wset_unsafe:
  MessageBox MB_ICONSTOP "The WSET program directory contains unknown or workspace files, or is a linked directory. Installation stopped." /SD IDOK
  SetErrorLevel 2
  Quit
  wset_safe:
!macroend
