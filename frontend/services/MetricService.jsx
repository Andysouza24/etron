import endpoints from "../utils/api/endpoints";
import { apiGet, apiPatch, apiPost, apiDelete } from "../utils/api/apiClient";
import { getWorkspaceId } from "../storage/workspaceStorage";

class MetricService {
    async #withWorkspace(payload = {}) {
        const workspaceId = await getWorkspaceId();
        return { workspaceId, ...payload };
    }

    // create a metric
    async createMetric(payload) {
        return apiPost(endpoints.modules.day_book.metrics.add, await this.#withWorkspace(payload));
    }


    // get a single metric
    async getMetric(metricId) {
        return apiGet(endpoints.modules.day_book.metrics.getMetric(metricId), await this.#withWorkspace());
    }

    // list metrics
    async getMetrics(){
        return apiGet(endpoints.modules.day_book.metrics.getMetrics, await this.#withWorkspace());
    }

    // update a metric
    async updateMetric(metricId, payload){
        return apiPatch(endpoints.modules.day_book.metrics.update(metricId), await this.#withWorkspace(payload));
    }

    // delete a metric
    async deleteMetric(metricId){
        return apiDelete(endpoints.modules.day_book.metrics.removeMetric(metricId), await this.#withWorkspace());
    }
    
    // fetch metric data
    async getMetricData(dataSourceId, metricId){
        return apiGet(endpoints.modules.day_book.data_sources.viewDataForMetric(dataSourceId, metricId), await this.#withWorkspace());
    }
    
    // get metrics by data source
    async getMetricsByDataSource(dataSourceId){
        return apiGet(endpoints.modules.day_book.metrics.getMetricsByDataSource(dataSourceId), await this.#withWorkspace());
    }

    // TODO: get upload/download URLs
    // TODO: fix
    /*async uploadGraphToS3(payload){
        return apiPut( TODO: endpoint here, await this.#withWorkspace(payload));
    }*/

    /*
    const response = await fetch(fileUploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: arrayBuffer,
    });
    */

}

// singleton instance
const metricService = new MetricService();
export default metricService;
export {MetricService};


