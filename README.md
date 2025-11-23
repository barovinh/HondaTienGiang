Honda Demo (HTML5 + CSS thuần)

Mô tả

- Trang mẫu thuần HTML/CSS/JS mô phỏng cấu trúc giống Honda.
- `header.html` và `footer.html` là file riêng, được `index.html` include bằng fetch.
- Điều hướng giữa các trang thực hiện bằng hash-router kèm hiệu ứng fade.
- Popup form xuất hiện lần đầu người dùng vào site (lưu trạng thái bằng `localStorage`).
- Khi gửi form, mã gọi EmailJS REST API. Thay các giá trị trong `js/app.js` (OBJECT `EMAILJS_CONFIG`) bằng `service_id`, `template_id`, `user_id` của bạn.

Chạy local

- Mở PowerShell và chạy server tĩnh trong thư mục dự án:

Hoặc dùng `Live Server` extension trong VS Code.

Cấu trúc chính

- `index.html` - shell chính, tải header/footer và pages
- `header.html`, `footer.html` - phần header/footer
- `pages/*.html` - các mảnh nội dung: `home.html`, `vehicles.html`, `about.html`, `contact.html`
- `pages/admin.html` - module Admin quản lý dữ liệu xe
- `pages/login.html` - trang đăng nhập cho quản trị
- `css/style.css` - stylesheet
- `js/app.js` - router, popup, điều khiển SPA + module Admin
- `js/admin-api.js` - client gọi Google Apps Script/Google Sheet API

Tùy chỉnh EmailJS

- Đăng ký EmailJS (https://www.emailjs.com/), tạo service và template.
- Trong `js/app.js` thay `EMAILJS_CONFIG` bằng các ID thật.
- Template params được gửi từ form (tên trường lúc này: `name`, `phone`, `email`, `vehicle`).

### Module Admin (GitHub Pages → Google Sheet → API)

Luồng hoạt động: **GitHub Pages (front-end tĩnh)** gọi **Google Apps Script Web App** → ghi/đọc dữ liệu trong **Google Sheet**.

1. **Chuẩn bị Google Sheet**: tạo sheet với các cột `rowId`, `name`, `description`, `price`, `slug`, `imageUrl`.
2. **Tạo Google Apps Script** (Extensions → Apps Script) và dùng ví dụ dưới đây:

   ```javascript
   const SHEET_NAME = "Vehicles";

   function doGet(e) {
     const rows = readRows();
     return respond({ success: true, data: rows });
   }

   function doPost(e) {
     return handleWrite(e, "create");
   }
   function doPut(e) {
     return handleWrite(e, "update");
   }
   function doDelete(e) {
     return handleWrite(e, "delete");
   }

   function handleWrite(e, action) {
     const { payload = {}, rowId } = JSON.parse(e.postData.contents);
     const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
     if (action === "create") {
       const nextId = new Date().getTime().toString();
       sheet.appendRow([
         nextId,
         payload.name,
         payload.description,
         payload.price,
         payload.slug,
         payload.imageUrl,
       ]);
       return respond({ success: true, rowId: nextId });
     }
     const targetRow = findRow(sheet, rowId);
     if (targetRow === -1)
       return respond({ success: false, message: "Không tìm thấy dòng" });
     if (action === "update") {
       sheet
         .getRange(targetRow, 2, 1, 5)
         .setValues([
           [
             payload.name,
             payload.description,
             payload.price,
             payload.slug,
             payload.imageUrl,
           ],
         ]);
       return respond({ success: true });
     }
     if (action === "delete") {
       sheet.deleteRow(targetRow);
       return respond({ success: true });
     }
   }

   function readRows() {
     const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
     const values = sheet.getDataRange().getValues();
     const [, ...rows] = values; // bỏ header
     return rows.map(([rowId, name, description, price, slug, imageUrl]) => ({
       rowId,
       name,
       description,
       price,
       slug,
       imageUrl,
     }));
   }

   function findRow(sheet, rowId) {
     const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
     for (let i = 0; i < data.length; i++) {
       if (data[i][0] === rowId) return i + 2;
     }
     return -1;
   }

   function respond(payload) {
     return ContentService.createTextOutput(
       JSON.stringify(payload)
     ).setMimeType(ContentService.MimeType.JSON);
   }
   ```

3. **Triển khai Web App**: Deploy → Manage deployments → New deployment → chọn Web App, quyền “Anyone with the link”. Sao chép URL.
4. **Cấu hình client**: Mở `js/admin-api.js` và thay `endpoint` bằng URL Apps Script, `apiKey` (tùy chọn) nếu bạn tự kiểm tra trong Apps Script.
5. **Đăng nhập**: mở `#/login`, nhập tài khoản mặc định `admin` / `admin`. Biến session `session_loggin` sẽ được đặt `true`; sau khi đăng nhập thành công trình duyệt chuyển đến `#/admin`.
6. **Sử dụng module Admin**: truy cập `#/admin` (nếu chưa đăng nhập sẽ bị chuyển về `#/login`) để tạo/cập nhật/xoá dòng. Nút “Đồng bộ” lưu dữ liệu xuống `localStorage` để trang Dòng xe sử dụng offline cache.
7. **Trang Dòng xe động**: `js/app.js` gọi `AdminApi.listVehicles()` khi vào `#/vehicles`, render grid và fallback sang cache khi offline.

> Lưu ý: Apps Script Web App không hỗ trợ CORS credentials, nên endpoint phải bật quyền public hoặc tự bổ sung xác thực bằng header `x-api-key` và kiểm tra trong script.

Gợi ý tiếp theo:

- Áp dụng xác thực cơ bản cho trang Admin (ví dụ mật khẩu ở build step hoặc Firebase Auth).
- Ghi log thao tác admin vào Sheet khác.
- Xuất dữ liệu ra JSON tĩnh (CDN) sau mỗi lần sync để giảm số lần gọi Apps Script.
