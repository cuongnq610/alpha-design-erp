(() => {
  'use strict';
  const count=(a,p=()=>true)=>(Array.isArray(a)?a:[]).filter(p).length;
  function assess(db,range={}){
    const posted=(db.journalEntries||[]).filter(x=>String(x.status).toLowerCase()==='posted');
    const activeTax=window.AlphaTaxCompliancePackageManager?.getActivePackage(db,range.to||new Date().toISOString().slice(0,10));
    const rows=[
      ['Quỹ tiền mặt','daily','supported','Sổ 111, phiếu thu/chi và đối chiếu sổ tiền đã có.'],
      ['Ngân hàng','daily',count(db.bankReconciliations)>0?'supported':'partial','Backend có tài khoản/giao dịch/đối chiếu ngân hàng; giao diện nhập sổ phụ và ghép tự động chưa hoàn thiện.'],
      ['Mua hàng & công nợ phải trả','daily',count(db.purchaseOrders)>0?'supported':'partial','Có đề nghị mua, đơn mua, hóa đơn đầu vào, TK 331 và phân bổ thanh toán.'],
      ['Bán hàng & công nợ phải thu','daily','supported','Có hợp đồng, mốc thanh toán, hóa đơn đầu ra, TK 131 và tuổi nợ.'],
      ['Hóa đơn điện tử','daily','partial','Có sổ hóa đơn và đối chiếu; chưa kết nối trực tiếp nhà cung cấp hóa đơn điện tử/cơ quan thuế.'],
      ['Kho & tính giá xuất kho','monthly','na','ALPHA DESIGN là doanh nghiệp tư vấn dịch vụ; chưa kích hoạt nghiệp vụ kho.'],
      ['CCDC & chi phí trả trước','monthly','supported','Có lịch phân bổ, kiểm soát phần dư và bút toán định kỳ.'],
      ['TSCĐ & khấu hao','monthly','supported','Có hồ sơ tài sản, lịch khấu hao và khóa lịch đã ghi sổ.'],
      ['Giá thành dự án','monthly','supported','Chi phí 154, timesheet, ngân sách và P&L dự án đã liên kết.'],
      ['Thuế GTGT/TNCN/TNDN','monthly',activeTax?'supported':'partial',activeTax?`Đang dùng gói ${activeTax.version}, hiệu lực ${activeTax.effectiveFrom}.`:'Có sổ và đối chiếu thuế nhưng chưa kích hoạt gói biểu mẫu thuế có ngày hiệu lực.'],
      ['Ngoại tệ & đánh giá lại','monthly','partial','Calculation Core có B03 chênh lệch tỷ giá; giao diện sổ ngoại tệ và đánh giá lại cuối kỳ chưa đầy đủ.'],
      ['Tổng hợp & khóa sổ','yearly','supported',`Có ${posted.length} chứng từ Posted, BCTC, kiểm tra toàn vẹn và khóa kỳ.`],
      ['Kết xuất XML nộp thuế','yearly','partial','Kiến trúc gói XML đã sẵn sàng; chỉ cho phép phát hành sau khi schema được xác minh theo HTKK/eTax hiện hành.']
    ].map(([name,cycle,status,detail])=>({name,cycle,status,detail}));
    const score=Math.round(rows.reduce((s,x)=>s+(x.status==='supported'?1:x.status==='partial'?.5:x.status==='na'?1:0),0)/rows.length*100);
    return {rows,score,supported:rows.filter(x=>x.status==='supported').length,partial:rows.filter(x=>x.status==='partial').length,notApplicable:rows.filter(x=>x.status==='na').length,activeTaxPackage:activeTax};
  }
  window.AlphaAccountingOperations={assess};
})();
