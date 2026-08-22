param(
  [Parameter(Mandatory = $true)][int]$RootPid,
  [string]$DeviceLabel = '',
  [switch]$Clear
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

namespace ShinaYuu.AudioRouting {
  enum DataFlow : int { Render = 0, Capture = 1, All = 2 }
  enum DeviceState : uint { Active = 0x00000001, Disabled = 0x00000002, NotPresent = 0x00000004, Unplugged = 0x00000008, Mask = 0x0000000F }
  enum Role : int { Console = 0, Multimedia = 1, Communications = 2 }

  [StructLayout(LayoutKind.Sequential)]
  struct PROPERTYKEY { public Guid fmtid; public uint pid; }

  [StructLayout(LayoutKind.Explicit)]
  struct PROPVARIANT {
    [FieldOffset(0)] public ushort vt;
    [FieldOffset(2)] public ushort wReserved1;
    [FieldOffset(4)] public ushort wReserved2;
    [FieldOffset(6)] public ushort wReserved3;
    [FieldOffset(8)] public IntPtr ptr;
    [FieldOffset(8)] public long longValue;
  }

  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
  class MMDeviceEnumeratorComObject { }

  [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
  interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(DataFlow dataFlow, uint stateMask, out IMMDeviceCollection devices);
    int GetDefaultAudioEndpoint(DataFlow dataFlow, Role role, out IMMDevice endpoint);
    int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
    int RegisterEndpointNotificationCallback(IntPtr client);
    int UnregisterEndpointNotificationCallback(IntPtr client);
  }

  [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("BD7C5FE5-26E8-423F-96AE-8E6F3F6B1A30")]
  interface IMMDeviceCollection {
    int GetCount(out uint count);
    int Item(uint index, out IMMDevice device);
  }

  [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("D666063F-1587-4E43-81F1-B948E807363F")]
  interface IMMDevice {
    int Activate(ref Guid iid, uint clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object instance);
    int OpenPropertyStore(uint access, out IPropertyStore properties);
    int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    int GetState(out uint state);
  }

  [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
  interface IPropertyStore {
    int GetCount(out uint count);
    int GetAt(uint index, out PROPERTYKEY key);
    int GetValue(ref PROPERTYKEY key, out PROPVARIANT value);
    int SetValue(ref PROPERTYKEY key, ref PROPVARIANT value);
    int Commit();
  }

  [Guid("ab3d4648-e242-459f-b02f-541c70306324"), InterfaceType(ComInterfaceType.InterfaceIsIInspectable)]
  interface IAudioPolicyConfigFactory {
    int __incomplete__add_CtxVolumeChange();
    int __incomplete__remove_CtxVolumeChanged();
    int __incomplete__add_RingerVibrateStateChanged();
    int __incomplete__remove_RingerVibrateStateChanged();
    int __incomplete__SetVolumeGroupGainForId();
    int __incomplete__GetVolumeGroupGainForId();
    int __incomplete__GetActiveVolumeGroupForEndpointId();
    int __incomplete__GetVolumeGroupsForEndpoint();
    int __incomplete__GetCurrentVolumeContext();
    int __incomplete__SetVolumeGroupMuteForId();
    int __incomplete__GetVolumeGroupMuteForId();
    int __incomplete__SetRingerVibrateState();
    int __incomplete__GetRingerVibrateState();
    int __incomplete__SetPreferredChatApplication();
    int __incomplete__ResetPreferredChatApplication();
    int __incomplete__GetPreferredChatApplication();
    int __incomplete__GetCurrentChatApplications();
    int __incomplete__add_ChatContextChanged();
    int __incomplete__remove_ChatContextChanged();
    uint SetPersistedDefaultAudioEndpoint(int processId, DataFlow flow, Role role, IntPtr deviceId);
    uint GetPersistedDefaultAudioEndpoint(int processId, DataFlow flow, Role role, [Out, MarshalAs(UnmanagedType.HString)] out string deviceId);
    uint ClearAllPersistedApplicationDefaultEndpoints();
  }

  static class Combase {
    [DllImport("combase.dll", PreserveSig = false)]
    public static extern void RoGetActivationFactory([MarshalAs(UnmanagedType.HString)] string className, ref Guid iid, [Out, MarshalAs(UnmanagedType.IInspectable)] out object factory);

    [DllImport("combase.dll", PreserveSig = false)]
    public static extern void WindowsCreateString([MarshalAs(UnmanagedType.LPWStr)] string source, uint length, out IntPtr hstring);

    [DllImport("combase.dll", PreserveSig = false)]
    public static extern void WindowsDeleteString(IntPtr hstring);
  }

  public sealed class AudioEndpointInfo {
    public string Id { get; set; }
    public string Label { get; set; }
  }

  public static class Router {
    static readonly PROPERTYKEY FriendlyNameKey = new PROPERTYKEY { fmtid = new Guid("A45C254E-DF1C-4EFD-8020-67D146A850E0"), pid = 14 };
    static readonly uint CLSCTX_ALL = 23;

    static string ReadFriendlyName(IMMDevice device) {
      IPropertyStore store = null;
      try {
        int hr = device.OpenPropertyStore(0, out store);
        if (hr != 0 || store == null) return '';
        PROPVARIANT pv;
        hr = store.GetValue(ref FriendlyNameKey, out pv);
        if (hr != 0) return '';
        try {
          // VT_LPWSTR = 31, VT_LPSTR = 30, VT_BSTR = 8
          if (pv.vt == 31 && pv.ptr != IntPtr.Zero) return Marshal.PtrToStringUni(pv.ptr) ?? '';
          if (pv.vt == 8 && pv.ptr != IntPtr.Zero) return Marshal.PtrToStringBSTR(pv.ptr) ?? '';
          return '';
        } finally {
          try { PropVariantClear(ref pv); } catch { }
        }
      } catch { return ''; }
      finally { if (store != null && Marshal.IsComObject(store)) Marshal.ReleaseComObject(store); }
    }

    [DllImport("ole32.dll")]
    static extern int PropVariantClear(ref PROPVARIANT pvar);

    static string Normalize(string value) {
      value = (value ?? '').Trim();
      return value.Normalize(System.Text.NormalizationForm.FormKC).ToLowerInvariant();
    }

    public static AudioEndpointInfo[] ListRenderEndpoints() {
      var output = new List<AudioEndpointInfo>();
      var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
      try {
        IMMDeviceCollection collection;
        Marshal.ThrowExceptionForHR(enumerator.EnumAudioEndpoints(DataFlow.Render, (uint)DeviceState.Active, out collection));
        try {
          uint count; collection.GetCount(out count);
          for (uint i = 0; i < count; i++) {
            IMMDevice device; if (collection.Item(i, out device) != 0 || device == null) continue;
            try { string id; if (device.GetId(out id) != 0) continue; output.Add(new AudioEndpointInfo { Id = id, Label = ReadFriendlyName(device) }); }
            finally { if (Marshal.IsComObject(device)) Marshal.ReleaseComObject(device); }
          }
        } finally { if (Marshal.IsComObject(collection)) Marshal.ReleaseComObject(collection); }
      } finally { if (Marshal.IsComObject(enumerator)) Marshal.ReleaseComObject(enumerator); }
      return output.ToArray();
    }

    static IAudioPolicyConfigFactory GetFactory() {
      Guid iid = typeof(IAudioPolicyConfigFactory).GUID;
      object factory;
      Combase.RoGetActivationFactory("Windows.Media.Internal.AudioPolicyConfig", ref iid, out factory);
      return (IAudioPolicyConfigFactory)factory;
    }

    public static int Route(int[] processIds, string deviceLabel, bool clear) {
      var factory = GetFactory();
      string endpointId = null;
      if (!clear) {
        var wanted = Normalize(deviceLabel);
        if (String.IsNullOrEmpty(wanted)) throw new ArgumentException("Device label is empty");
        var candidates = ListRenderEndpoints();
        AudioEndpointInfo best = null;
        foreach (var candidate in candidates) {
          var label = Normalize(candidate.Label);
          if (label == wanted) { best = candidate; break; }
          if (label.Contains(wanted) || wanted.Contains(label)) best ??= candidate;
        }
        if (best == null) throw new InvalidOperationException("Native render endpoint not found for label: " + deviceLabel);
        endpointId = best.Id;
      }
      int changed = 0;
      foreach (var pid in processIds) {
        foreach (Role role in new[] { Role.Console, Role.Multimedia, Role.Communications }) {
          IntPtr ptr = IntPtr.Zero;
          try {
            if (!clear) {
              Combase.WindowsCreateString(endpointId, (uint)endpointId.Length, out ptr);
            }
            uint hr = factory.SetPersistedDefaultAudioEndpoint(pid, DataFlow.Render, role, ptr);
            if (hr == 0) changed++;
          } finally { if (ptr != IntPtr.Zero) { try { Combase.WindowsDeleteString(ptr); } catch { } } }
        }
      }
      return changed;
    }
  }
}
'@

function Get-ProcessParentIdUnsafe {
  param([int]$Id)
  try {
    $row = Get-CimInstance Win32_Process -Filter "ProcessId = $Id" -ErrorAction Stop
    if ($row) { return [int]$row.ParentProcessId }
  } catch { }
  return 0
}

# Extend System.Diagnostics.Process with a helper-like script property through a small shim method.
# The C# implementation above expects ParentIdUnsafe(); replace process-tree discovery with PowerShell below when needed.
$rootIds = @($RootPid)

$rows = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId)
$set = New-Object 'System.Collections.Generic.HashSet[int]'
foreach ($id in $rootIds) { if ($id -gt 0) { [void]$set.Add([int]$id) } }
$changed = $true
while ($changed) {
  $changed = $false
  foreach ($row in $rows) {
    if ($set.Contains([int]$row.ParentProcessId) -and -not $set.Contains([int]$row.ProcessId)) {
      [void]$set.Add([int]$row.ProcessId)
      $changed = $true
    }
  }
}

# The AudioPolicyConfig COM factory is used directly here because Windows app-specific audio routing
# is stored per process. We select the native endpoint by its friendly name and apply it to the
# ShinaYuu process tree (main + renderer/helper processes).
$ErrorActionPreference = 'Stop'

$factoryType = [ShinaYuu.AudioRouting.Router]
if ($Clear) {
  # Clearing is represented by routing to the current system default endpoint; this avoids touching
  # other applications while removing the custom ShinaYuu preference in the Windows audio policy UI.
  $null = $factoryType::Route([int[]]$set, '', $true)
  Write-Output "OK clear rootPid=$RootPid"
} else {
  $count = $factoryType::Route([int[]]$set, $DeviceLabel, $false)
  Write-Output "OK routed=$count rootPid=$RootPid label=$DeviceLabel"
}
